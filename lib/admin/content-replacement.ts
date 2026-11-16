import { CONTENT_SCHEMAS } from '../content-types'
import { fileType, fileTypes, type AttachmentInput } from './content'
import { validateAssetPackFiles } from './asset-pack'
import { validateMusicFiles } from './music'
import { validateGameFiles } from './game'
import { CONTENT_LIMITS } from './limits'

export type ExistingContentFile = {
  assetId: string; role: 'cover' | 'preview' | 'download'; mediaType: string; mimeType: string | null
}

/** Uploading a group replaces only that group; an omitted group keeps its files. */
export function replacementRoles(schemaKey: string, attachments: AttachmentInput[]) {
  const roles = new Set<ExistingContentFile['role']>()
  for (const asset of attachments) {
    const image = fileType(asset.path)?.mediaType === 'image'
    if (schemaKey === CONTENT_SCHEMAS.asset) roles.add(asset.role)
    else if (image && (schemaKey === CONTENT_SCHEMAS.music || schemaKey === CONTENT_SCHEMAS.game)) roles.add('cover')
    else {
      roles.add('download')
      if (image) roles.add('cover')
    }
  }
  return [...roles]
}

/** Validate the resulting item using trusted existing files and the new uploads. */
export function validateContentReplacement(schemaKey: string, attachments: AttachmentInput[], existing: ExistingContentFile[]) {
  if (!attachments.length) return undefined
  const isPack = schemaKey === CONTENT_SCHEMAS.asset
  if (!isPack && attachments.some(asset => asset.role !== 'download')) {
    return 'Separate thumbnails and preview uploads are only supported for asset packs.'
  }
  const roles = replacementRoles(schemaKey, attachments)
  const kept = existing.filter(asset => !roles.includes(asset.role))
  // Validation needs a file extension, not a storage URL or a staged upload of retained bytes.
  const retained = kept.map(asset => ({ ...asset, path: `retained.${Object.entries(fileTypes).find(([, type]) => type.mime === asset.mimeType)?.[0]
    ?? (asset.mediaType === 'image' ? 'webp' : 'unknown')}` }))
  const combined = [...retained, ...attachments]
  if (isPack) return validateAssetPackFiles(combined)
  if (combined.filter(asset => asset.role !== 'cover').length > CONTENT_LIMITS.files) return `Attach up to ${CONTENT_LIMITS.files} files per item.`
  if (schemaKey === CONTENT_SCHEMAS.music) return validateMusicFiles(combined, true)
  if (schemaKey === CONTENT_SCHEMAS.game) return validateGameFiles(combined, true)
  if (!combined.some(asset => fileType(asset.path)?.mediaType === 'image')) return 'Keep or upload a thumbnail image.'
}
