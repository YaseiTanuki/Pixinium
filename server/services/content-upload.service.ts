import { validateSourceLinks } from '@/lib/download-sources'
import { listDownloadProviders } from './download-sources.service'
import { CONTENT_SCHEMAS, usesAutomaticFacts } from '../../lib/content-types'
import 'server-only'

import { imageFacts, imageCreator } from '@/lib/image-facts'
import { randomUUID } from 'node:crypto'
import { neon } from '@neondatabase/serverless'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { hasPermission } from '@/lib/auth/permissions'
import { contentSchema, fileType, MAX_CONTENT_FILE_BYTES, type ContentResult } from '@/lib/admin/content'
import { parseCategoryMetadata } from '@/lib/entities/metadata'
import { requirePrivateStorage, signUpload, deleteStagingUploads, cleanupExpiredStaging } from '@/server/services/storage.service'
import { ownedStagingPaths } from '@/lib/admin/staging'
import { itemStorageDirectory } from '@/lib/admin/storage-paths'
import { createContentWithTitleSlug, withContentSlug } from '@/server/services/content-create'
import { validateContentFiles, inspectContentFiles, finalizeContentFiles } from '@/server/services/content-files'
import { deleteGeneratedPackFiles } from '@/server/services/storage.service'
import { authDiagnostic } from '@/lib/auth/errors'
import { contentCreateDiagnostic, type ContentCreateStage } from '@/lib/content-diagnostics'
import { setUploadTraceContext } from '@/lib/upload-tracing'
import { isAgentActor, stagingOwner, type ContentActor } from '@/lib/agent-identity'
import { agentCall, agentDatabase } from './agent-store'

export type { ContentActor } from '@/lib/agent-identity'

export async function prepareContentUploadForActor(account: ContentActor | null, input: unknown) {
  try {
    if (!account || (!isAgentActor(account) && !hasPermission(account.role, 'assets:upload'))) return { error: 'Upload access is required.' }
    const { name, size } = z.object({ name: z.string().max(255), size: z.number().int().positive().max(MAX_CONTENT_FILE_BYTES) }).parse(input)
    const type = fileType(name)
    if (!type) return { error: 'Choose an image, audio, video, PDF or ZIP file from the supported formats.' }
    const owner = stagingOwner(account)
    const path = `${owner}/${randomUUID()}.${type.extension}`
    if (isAgentActor(account)) await agentCall(account, 'reserve_upload', [path, size])
    try { await cleanupExpiredStaging(owner) }
    catch (error) { console.error('[content.expired-staging]', authDiagnostic(error)) }
    const { bucket, url } = await signUpload(path, type.mime, size)
    return { bucket, path, url, mime: type.mime }
  } catch (error) {
    if (authDiagnostic(error).code.startsWith('P04')) throw error
    console.error('[content.upload]', authDiagnostic(error))
    return { error: error instanceof z.ZodError ? 'Choose a file up to 50 MB.' : 'Upload storage is unavailable.' }
  }
}

export async function discardContentUploadsForActor(account: ContentActor | null, input: unknown): Promise<ContentResult> {
  try {
    if (!account || (!isAgentActor(account) && !hasPermission(account.role, 'assets:upload'))) return { error: 'Upload access is required.' }
    const paths = ownedStagingPaths(input, stagingOwner(account))
    const approved = isAgentActor(account) ? await agentCall<string[]>(account, 'discard_uploads', [paths]) : paths
    await deleteStagingUploads(approved)
    return { message: 'Temporary uploads deleted.' }
  } catch (error) {
    if (authDiagnostic(error).code.startsWith('P04')) throw error
    return { error: 'Could not delete temporary uploads. Please retry.' }
  }
}

export async function createContentForActor(account: ContentActor | null, input: unknown, source: 'studio' | 'agent' = 'studio'): Promise<ContentResult> {
  let pendingPack: { directory: string; paths: string[] } | undefined
  let committed = false
  let stage: ContentCreateStage = 'validate'
  const setStage = (value: ContentCreateStage) => {
    stage = value
    setUploadTraceContext({ 'upload.stage': value })
  }
  setStage('validate')
  try {
    if (!account || (!isAgentActor(account) && !hasPermission(account.role, 'assets:upload'))) return { error: 'You do not have access to create content.' }
    setUploadTraceContext(isAgentActor(account) ? { 'agent.id': account.id } : { 'user.id': account.id })
    if (isAgentActor(account) && !account.job) return { error: 'An agent job is required.' }
    const parsed = contentSchema.safeParse(isAgentActor(account) && input && typeof input === 'object'
      ? { ...input, status: 'draft' } : input)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the content fields.' }
    const value = parsed.data
    setStage('download_providers')
    const sourceError = validateSourceLinks(value.downloadSources, await listDownloadProviders())
    if (sourceError) return { error: sourceError }
    const connection = process.env.CATALOG_ADMIN_DATABASE_URL
    if (!isAgentActor(account) && !connection) return { error: 'Content writing is not configured. Set the server-side catalog admin connection.' }
    const sql = isAgentActor(account) ? undefined : neon(connection!)
    setStage('category')
    const categories = isAgentActor(account)
      ? [await agentCall<{ slug: string; metadata_schema_key: string }>(account, 'category', [value.categoryId])]
      : await sql!`SELECT slug, metadata_schema_key FROM catalog.categories WHERE id = ${value.categoryId}::bigint AND is_active`
    if (!categories[0]) return { error: 'Choose an active category.' }
    const schemaKey = String(categories[0].metadata_schema_key)
    const isMusic = schemaKey === CONTENT_SCHEMAS.music
    const isGame = schemaKey === CONTENT_SCHEMAS.game
    const isAssetPack = schemaKey === CONTENT_SCHEMAS.asset
    const fileError = validateContentFiles(schemaKey, value.attachments)
    if (fileError) return { error: fileError }
    let metadata = parseCategoryMetadata(schemaKey, isAssetPack
      ? { image_count: value.attachments.filter(asset => asset.role === 'download').length }
      : isMusic ? {} : value.metadata)
    setStage('storage_policy')
    const { bucket } = await requirePrivateStorage()
    setStage('claim_uploads')
    if (isAgentActor(account)) await agentCall(account, 'claim_uploads', [account.job!.id, account.job!.leaseToken, value.attachments.map(asset => asset.path)])
    setStage('inspect_uploads')
    const inspected = await inspectContentFiles(stagingOwner(account), value.attachments)
    if ('error' in inspected) return { error: inspected.error }
    const attachments = inspected.attachments
    // Allocate a stable identity before copying files; failed saves may leave sequence gaps.
    setStage('reserve_item')
    const [reservation] = isAgentActor(account) ? [{ id: account.job!.itemId }]
      : await sql!`SELECT nextval(pg_get_serial_sequence('catalog.items', 'id'))::text AS id`
    const reservedItemId = String(reservation.id)
    const directory = isAgentActor(account)
      ? `agents/${account.id}/items/${reservedItemId}/${account.job!.leaseToken}`
      : itemStorageDirectory(String(categories[0].slug), reservedItemId)
    setStage('finalize_files')
    const { finalized, pack, musicMetadata } = await finalizeContentFiles(schemaKey, attachments, directory)
    pendingPack = pack
    if (musicMetadata) metadata = musicMetadata
    setStage('facts')
    let facts = value.facts
    if (usesAutomaticFacts(schemaKey)) {
      const [profile] = !isAgentActor(account) && source === 'studio' && account.role !== 'admin'
        ? await sql!`SELECT username FROM catalog.profiles WHERE id = ${account.id}::uuid` : []
      const original = finalized.find(asset => asset.role === 'download' && asset.mediaType === 'image')
      const creator = imageCreator(source, profile?.username as string | null | undefined, isAgentActor(account) ? 'agent' : account.role)
      facts = imageFacts(reservedItemId, original ? { ...original, mimeType: original.mime } : undefined, creator)
        .filter(fact => fact.key === 'creator')
    }
    const document = { ...value, reservedItemId, metadata, facts, attachments: finalized }
    setStage('save_item')
    const rows = isAgentActor(account)
      ? await withContentSlug(value.title,
        async base => {
          const values = [account.keyId, account.tokenHash, value.categoryId, base]
          return agentDatabase().query('SELECT * FROM automation.content_slugs($1,$2,$3,$4)', values)
        },
        async slug => [await agentCall<Record<string, unknown>>(account, 'publish_job', [account.job!.id, account.job!.leaseToken, schemaKey, JSON.stringify({ ...document, slug }), bucket])])
      : await createContentWithTitleSlug((text, values) => sql!.query(text, values), account.id, value.categoryId, schemaKey, document, bucket)
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
    const status = isAgentActor(account) ? 'draft' : value.status
    return { id: String(rows[0].id), slug: String(rows[0].slug), category: String(rows[0].category), status,
      message: status === 'draft' ? 'Content saved as a draft for admin review.' : 'Content published to the archive.',
      ...(status === 'published' ? { href: `/items/${rows[0].category}/${rows[0].slug}` } : {}) }
  } catch (error) {
    if (authDiagnostic(error).code.startsWith('P04')) throw error
    const diagnostic = contentCreateDiagnostic(error, stage)
    setUploadTraceContext({ 'upload.error.provider': diagnostic.providerError ?? diagnostic.code })
    console.error(JSON.stringify(diagnostic))
    if (error instanceof z.ZodError) return { error: error.issues[0]?.message ?? 'Check category details.' }
    if (authDiagnostic(error).code === '23505') return { error: 'Content could not be saved because of a duplicate entry. Please try again.' }
    return { error: 'Content could not be saved. Your form is preserved; check server configuration and try again.' }
  } finally {
    if (pendingPack && !committed) {
      // Transport failure can hide a successful commit; keep any referenced objects.
      try {
        if (account && isAgentActor(account)) {
          const state = await agentCall<string>(account, 'job_state', [account.job!.id])
          if (state && state !== 'succeeded') await deleteGeneratedPackFiles(pendingPack.directory, pendingPack.paths)
        } else {
          const sql = neon(process.env.CATALOG_ADMIN_DATABASE_URL!)
          const linked = await sql.query('SELECT 1 FROM catalog.assets WHERE provider = $1 AND object_path = ANY($2::text[]) LIMIT 1', ['s3', pendingPack.paths])
          if (!linked.length) await deleteGeneratedPackFiles(pendingPack.directory, pendingPack.paths)
        }
      } catch (error) { console.error('[content.pack-cleanup]', authDiagnostic(error)) }
    }
  }
}
