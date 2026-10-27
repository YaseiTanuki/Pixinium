import { CONTENT_SCHEMAS } from '../../lib/content-types'
import 'server-only'

import { imageFacts, imageCreator } from '@/lib/image-facts'
import { assetFacts } from '@/lib/asset-facts'
import { randomUUID } from 'node:crypto'
import { neon } from '@neondatabase/serverless'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { hasPermission } from '@/lib/auth/permissions'
import { contentSchema, fileType, MAX_CONTENT_FILE_BYTES, type ContentResult } from '@/lib/admin/content'
import { parseCategoryMetadata } from '@/lib/entities/metadata'
import { requirePrivateStorage, signUpload, inspectUpload, finalizeUpload, storeImageThumbnail, deleteStagingUploads, cleanupExpiredStaging, readStoredBytes } from '@/server/services/storage.service'
import { readAudioMetadata } from '@/server/services/audio-metadata'
import { validateMusicFiles } from '@/lib/admin/music'
import { validateGameFiles } from '@/lib/admin/game'
import { ownedStagingPaths } from '@/lib/admin/staging'
import { itemStorageDirectory } from '@/lib/admin/storage-paths'
import { createContentWithTitleSlug } from '@/server/services/content-create'
import { createAssetPack } from '@/server/services/asset-pack'
import { validateAssetPackFiles } from '@/lib/admin/asset-pack'
import { CONTENT_LIMITS } from '@/lib/admin/limits'
import { storeGeneratedImage, storeGeneratedZip, deleteGeneratedPackFiles } from '@/server/services/storage.service'
import { authDiagnostic } from '@/lib/auth/errors'

export type ContentActor = { id: string; role: string }

export async function prepareContentUploadForActor(account: ContentActor | null, input: unknown) {
  try {
    if (!account || !hasPermission(account.role, 'assets:upload')) return { error: 'Upload access is required.' }
    const { name, size } = z.object({ name: z.string().max(255), size: z.number().int().positive().max(MAX_CONTENT_FILE_BYTES) }).parse(input)
    const type = fileType(name)
    if (!type) return { error: 'Choose an image, audio, video, PDF or ZIP file from the supported formats.' }
    try { await cleanupExpiredStaging(account.id) }
    catch (error) { console.error('[content.expired-staging]', authDiagnostic(error)) }
    const path = `${account.id}/${randomUUID()}.${type.extension}`
    const { bucket, url } = await signUpload(path, type.mime, size)
    return { bucket, path, url, mime: type.mime }
  } catch (error) {
    console.error('[content.upload]', authDiagnostic(error))
    return { error: error instanceof z.ZodError ? 'Choose a file up to 50 MB.' : 'Upload storage is unavailable.' }
  }
}

export async function discardContentUploadsForActor(account: ContentActor | null, input: unknown): Promise<ContentResult> {
  try {
    if (!account || !hasPermission(account.role, 'assets:upload')) return { error: 'Upload access is required.' }
    await deleteStagingUploads(ownedStagingPaths(input, account.id))
    return { message: 'Temporary uploads deleted.' }
  } catch {
    return { error: 'Could not delete temporary uploads. Please retry.' }
  }
}

export async function createContentForActor(account: ContentActor | null, input: unknown, source: 'studio' | 'agent' = 'studio'): Promise<ContentResult> {
  let pendingPack: { directory: string; paths: string[] } | undefined
  let committed = false
  try {
    if (!account || !hasPermission(account.role, 'assets:upload')) return { error: 'You do not have access to create content.' }
    const parsed = contentSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the content fields.' }
    const value = parsed.data
    const connection = process.env.CATALOG_ADMIN_DATABASE_URL
    if (!connection) return { error: 'Content writing is not configured. Set the server-side catalog admin connection.' }
    const sql = neon(connection)
    const categories = await sql`SELECT slug, metadata_schema_key FROM catalog.categories WHERE id = ${value.categoryId}::bigint AND is_active`
    if (!categories[0]) return { error: 'Choose an active category.' }
    const validUses = await sql.query('SELECT slug FROM catalog.content_uses WHERE slug = ANY($1::text[])', [value.uses])
    if (validUses.length !== value.uses.length) return { error: 'A selected use is no longer available. Reload the studio.' }
    const schemaKey = String(categories[0].metadata_schema_key)
    const isMusic = schemaKey === CONTENT_SCHEMAS.music
    const isGame = schemaKey === CONTENT_SCHEMAS.game
    const isAssetPack = schemaKey === CONTENT_SCHEMAS.asset
    if (!isAssetPack && value.attachments.length > CONTENT_LIMITS.files) {
      return { error: `Attach up to ${CONTENT_LIMITS.files} files per item.` }
    }
    if (isAssetPack) {
      const error = validateAssetPackFiles(value.attachments)
      if (error) return { error }
    } else if (value.attachments.some(asset => asset.role !== 'download')) {
      return { error: 'Separate thumbnails are only supported for asset packs.' }
    }
    if (isGame) {
      const error = validateGameFiles(value.attachments, value.status === 'published')
      if (error) return { error }
    }
    if (isMusic) {
      const error = validateMusicFiles(value.attachments, value.status === 'published')
      if (error) return { error }
    }
    let metadata = parseCategoryMetadata(schemaKey, isAssetPack
      ? { image_count: value.attachments.filter(asset => asset.role === 'download').length }
      : isMusic ? {} : value.metadata)
    const { bucket } = await requirePrivateStorage()
    const attachments = []
    for (const asset of value.attachments) {
      if (!asset.path.startsWith(`${account.id}/`)) return { error: 'Upload each attachment from your account.' }
      const type = fileType(asset.path)!
      const data = await inspectUpload(asset.path)
      if (!data.ContentLength || data.ContentLength > MAX_CONTENT_FILE_BYTES || data.ContentType !== type.mime || !data.ETag) {
        return { error: 'An attachment is missing, oversized or has an unexpected file type. Upload it again.' }
      }
      attachments.push({ ...asset, ...type, byteSize: data.ContentLength, etag: data.ETag })
    }
    // Allocate a stable identity before copying files; failed saves may leave sequence gaps.
    const [reservation] = await sql`SELECT nextval(pg_get_serial_sequence('catalog.items', 'id'))::text AS id`
    const reservedItemId = String(reservation.id)
    const directory = itemStorageDirectory(String(categories[0].slug), reservedItemId)
    const finalized = []
    let hasThumbnail = false
    const tracks: Awaited<ReturnType<typeof readAudioMetadata>>[] = []
    if (isAssetPack) {
      const pack = await createAssetPack(attachments, directory, {
        read: asset => readStoredBytes(`staging/${asset.path}`, asset.byteSize, asset.etag),
        putImage: storeGeneratedImage,
        putZip: storeGeneratedZip,
        remove: paths => deleteGeneratedPackFiles(directory, paths),
      })
      pendingPack = { directory, paths: pack.map(asset => asset.path) }
      finalized.push(...pack)
    } else for (const asset of attachments) {
      if ((isMusic || isGame) && asset.mediaType === 'image') {
        // Artwork is temporary input: retain only its generated thumbnail.
        const thumbnail = await storeImageThumbnail(`staging/${asset.path}`, asset.byteSize, directory, asset.etag)
        finalized.push({ ...asset, ...thumbnail, role: 'cover' as const })
        continue
      }
      const audio = isMusic && asset.mediaType === 'audio'
        ? await readAudioMetadata(await readStoredBytes(`staging/${asset.path}`, asset.byteSize, asset.etag), asset.extension) : undefined
      if (audio) tracks.push(audio)
      const original = { ...asset, path: await finalizeUpload(asset.path, asset.etag, asset.mime, asset.byteSize, directory) }
      if (asset.mediaType === 'image' && !hasThumbnail) {
        const thumbnail = await storeImageThumbnail(original.path, asset.byteSize, directory)
        finalized.push({ ...original, width: thumbnail.originalWidth, height: thumbnail.originalHeight, mime: thumbnail.originalMime })
        finalized.push({ ...asset, ...thumbnail, role: 'cover' as const })
        hasThumbnail = true
      } else finalized.push({ ...original, ...(audio ? { durationSeconds: audio.durationSeconds } : {}) })
    }
    if (isMusic) metadata = parseCategoryMetadata(schemaKey, tracks.length ? {
      track_count: tracks.length, duration_seconds: Math.round(tracks.reduce((sum, track) => sum + track.durationSeconds, 0)),
      formats: [...new Set(tracks.map(track => track.format))],
    } : {})
    let facts = value.facts
    if (schemaKey === CONTENT_SCHEMAS.image || isAssetPack) {
      const [profile] = source === 'studio' && account.role !== 'admin'
        ? await sql`SELECT username FROM catalog.profiles WHERE id = ${account.id}::uuid` : []
      const original = finalized.find(asset => asset.role === 'download' && asset.mediaType === 'image')
      const creator = imageCreator(source, profile?.username as string | null | undefined, account.role)
      facts = isAssetPack
        ? assetFacts(reservedItemId, value.attachments.filter(asset => asset.role === 'download').length,
          finalized.find(asset => asset.role === 'download')?.mime, creator)
        : imageFacts(reservedItemId, original ? { ...original, mimeType: original.mime } : undefined, creator)
    }
    const rows = await createContentWithTitleSlug((text, values) => sql.query(text, values),
      account.id, value.categoryId, schemaKey, { ...value, reservedItemId, metadata, facts, attachments: finalized }, bucket)
    if (!rows[0]) return { error: 'Your permissions or category changed. Reload the studio and try again.' }
    committed = true
    // The committed item owns separate final objects. A cleanup outage must not
    // turn a successful save into a retry that creates a duplicate item.
    try { await deleteStagingUploads(value.attachments.map(asset => asset.path)) }
    catch (error) { console.error('[content.staging-cleanup]', authDiagnostic(error)) }
    try {
      revalidatePath('/')
      revalidatePath('/search')
      revalidatePath('/admin')
    } catch (error) { console.error('[content.revalidate]', authDiagnostic(error)) }
    return { id: String(rows[0].id), slug: String(rows[0].slug), category: String(rows[0].category), message: 'Content published to the archive.',
      href: `/items/${rows[0].category}/${rows[0].slug}` }
  } catch (error) {
    console.error('[content.create]', authDiagnostic(error))
    if (error instanceof z.ZodError) return { error: error.issues[0]?.message ?? 'Check category details.' }
    if (authDiagnostic(error).code === '23505') return { error: 'Content could not be saved because of a duplicate entry. Please try again.' }
    return { error: 'Content could not be saved. Your form is preserved; check server configuration and try again.' }
  } finally {
    if (pendingPack && !committed) {
      // Transport failure can hide a successful commit; keep any referenced objects.
      try {
        const sql = neon(process.env.CATALOG_ADMIN_DATABASE_URL!)
        const linked = await sql.query('SELECT 1 FROM catalog.assets WHERE provider = $1 AND object_path = ANY($2::text[]) LIMIT 1', ['s3', pendingPack.paths])
        if (!linked.length) await deleteGeneratedPackFiles(pendingPack.directory, pendingPack.paths)
      } catch (error) { console.error('[content.pack-cleanup]', authDiagnostic(error)) }
    }
  }
}
