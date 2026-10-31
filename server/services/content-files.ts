import 'server-only'

import { CONTENT_SCHEMAS } from '@/lib/content-types'
import { fileType, MAX_CONTENT_FILE_BYTES, type AttachmentInput } from '@/lib/admin/content'
import { parseCategoryMetadata } from '@/lib/entities/metadata'
import { validateMusicFiles } from '@/lib/admin/music'
import { validateGameFiles } from '@/lib/admin/game'
import { validateAssetPackFiles } from '@/lib/admin/asset-pack'
import { CONTENT_LIMITS } from '@/lib/admin/limits'
import { inspectUpload, finalizeUpload, storeImageThumbnail, readStoredBytes, storeGeneratedImage, storeGeneratedZip, deleteGeneratedPackFiles } from '@/server/services/storage.service'
import { readAudioMetadata } from '@/server/services/audio-metadata'
import { createAssetPack } from '@/server/services/asset-pack'

/** Category rules shared by creating content and replacing its files. */
export function validateContentFiles(schemaKey: string, attachments: AttachmentInput[]) {
  const isAssetPack = schemaKey === CONTENT_SCHEMAS.asset
  if (!isAssetPack && attachments.length > CONTENT_LIMITS.files) return `Attach up to ${CONTENT_LIMITS.files} files per item.`
  if (isAssetPack) {
    const error = validateAssetPackFiles(attachments)
    if (error) return error
  } else if (attachments.some(asset => asset.role !== 'download')) {
    return 'Separate thumbnails are only supported for asset packs.'
  }
  if (schemaKey === CONTENT_SCHEMAS.game) return validateGameFiles(attachments, true)
  if (schemaKey === CONTENT_SCHEMAS.music) return validateMusicFiles(attachments, true)
  return undefined
}

/** Confirm each staged upload belongs to the actor and still matches its declared type. */
export async function inspectContentFiles(accountId: string, attachments: AttachmentInput[]) {
  const inspected = []
  for (const asset of attachments) {
    if (!asset.path.startsWith(`${accountId}/`)) return { error: 'Upload each attachment from your account.' }
    const type = fileType(asset.path)!
    const data = await inspectUpload(asset.path)
    if (!data.ContentLength || data.ContentLength > MAX_CONTENT_FILE_BYTES || data.ContentType !== type.mime || !data.ETag) {
      return { error: 'An attachment is missing, oversized or has an unexpected file type. Upload it again.' }
    }
    inspected.push({ ...asset, ...type, byteSize: data.ContentLength, etag: data.ETag })
  }
  return { attachments: inspected }
}

type InspectedFile = Extract<Awaited<ReturnType<typeof inspectContentFiles>>, { attachments: unknown }>['attachments'][number]

/** Copy staged uploads into `directory`; `pack` lists generated files that need cleanup if the save fails. */
export async function finalizeContentFiles(schemaKey: string, attachments: InspectedFile[], directory: string) {
  const isMusic = schemaKey === CONTENT_SCHEMAS.music
  const isGame = schemaKey === CONTENT_SCHEMAS.game
  const finalized = []
  let pack: { directory: string; paths: string[] } | undefined
  let hasThumbnail = false
  const tracks: Awaited<ReturnType<typeof readAudioMetadata>>[] = []
  if (schemaKey === CONTENT_SCHEMAS.asset) {
    const generated = await createAssetPack(attachments, directory, {
      read: asset => readStoredBytes(`staging/${asset.path}`, asset.byteSize, asset.etag),
      putImage: storeGeneratedImage,
      putZip: storeGeneratedZip,
      remove: paths => deleteGeneratedPackFiles(directory, paths),
    })
    pack = { directory, paths: generated.map(asset => asset.path) }
    finalized.push(...generated)
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
  const musicMetadata = isMusic ? parseCategoryMetadata(schemaKey, tracks.length ? {
    track_count: tracks.length, duration_seconds: Math.round(tracks.reduce((sum, track) => sum + track.durationSeconds, 0)),
    formats: [...new Set(tracks.map(track => track.format))],
  } : {}) : undefined
  return { finalized, pack, musicMetadata }
}
