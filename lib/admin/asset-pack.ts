import { fileType } from './content'
import { ASSET_PACK_LIMITS } from './limits'

export function validateAssetPackFiles(attachments: { path: string; role: string }[], partial = false): string | undefined {
  const covers = attachments.filter(asset => asset.role === 'cover').length
  if (covers > 1 || (!partial && covers !== 1)) {
    return 'Upload exactly one separate thumbnail for the asset pack.'
  }
  if (attachments.filter(asset => asset.role === 'preview').length > ASSET_PACK_LIMITS.previews) {
    return `Upload up to ${ASSET_PACK_LIMITS.previews} preview images.`
  }
  const downloads = attachments.filter(asset => asset.role === 'download')
  if (downloads.length > 1 || (!partial && downloads.length !== 1) || downloads.some(asset => fileType(asset.path)?.extension !== 'zip')) {
    return 'Upload exactly one ZIP file for the asset pack.'
  }
  if (attachments.some(asset => asset.role !== 'download' && fileType(asset.path)?.mediaType !== 'image')) {
    return 'Pack thumbnail and previews must be supported images.'
  }
}
