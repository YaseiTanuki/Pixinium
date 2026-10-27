import { fileType, type AttachmentInput } from './content'
import { ASSET_PACK_LIMITS } from './limits'

export function validateAssetPackFiles(attachments: AttachmentInput[]): string | undefined {
  if (attachments.some(asset => fileType(asset.path)?.mediaType !== 'image')) {
    return 'Asset packs accept only images. The ZIP is generated automatically.'
  }
  if (attachments.filter(asset => asset.role === 'cover').length !== 1) {
    return 'Upload exactly one separate thumbnail for the asset pack.'
  }
  const images = attachments.filter(asset => asset.role === 'download')
  if (images.length < 1 || images.length > ASSET_PACK_LIMITS.images) {
    return `Upload between 1 and ${ASSET_PACK_LIMITS.images} pack images.`
  }
}

/** Numbered, flat names prevent traversal, collisions and Windows reserved filenames. */
export function packEntryName(asset: Pick<AttachmentInput, 'fileName' | 'path'>, index: number) {
  const extension = fileType(asset.path)?.extension
  if (!extension) throw new Error('Unsupported pack image')
  const name = (asset.fileName ?? '').split(/[\\/]/).pop() ?? ''
  const stem = name.replace(/\.[^.]*$/, '').normalize('NFKC')
    .replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'image'
  return `${String(index + 1).padStart(2, '0')}-${stem}.${extension}`
}
