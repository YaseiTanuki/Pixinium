import { fileType, type AttachmentInput } from './content'
import { ASSET_PACK_LIMITS } from './limits'

export function validateAssetPackFiles(attachments: AttachmentInput[]): string | undefined {
  if (attachments.filter(asset => asset.role === 'cover').length !== 1) {
    return 'Upload exactly one separate thumbnail for the asset pack.'
  }
  if (attachments.filter(asset => asset.role === 'preview').length > ASSET_PACK_LIMITS.previews) {
    return `Upload up to ${ASSET_PACK_LIMITS.previews} preview images.`
  }
  const downloads = attachments.filter(asset => asset.role === 'download')
  if (downloads.length !== 1 || fileType(downloads[0].path)?.extension !== 'zip') {
    return 'Upload exactly one ZIP file for the asset pack.'
  }
  if (attachments.some(asset => asset.role !== 'download' && fileType(asset.path)?.mediaType !== 'image')) {
    return 'Pack thumbnail and previews must be supported images.'
  }
}
