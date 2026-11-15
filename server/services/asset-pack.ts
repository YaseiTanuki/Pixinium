import { validateAssetPackFiles } from '../../lib/admin/asset-pack'
import type { AttachmentInput } from '../../lib/admin/content'
import { createImageThumbnail } from '@/server/services/image-thumbnail'

export type InspectedPackFile = AttachmentInput & { byteSize: number; etag: string }
type PackAttachment = {
  path: string
  role: 'cover' | 'preview' | 'download'
  mediaType: 'image' | 'file'
  mime: string
  byteSize: number
  altText: string
  focalX: number
  focalY: number
  width?: number
  height?: number
}

interface PackStorage {
  read: (asset: InspectedPackFile) => Promise<Uint8Array>
  putImage: (path: string, data: Uint8Array) => Promise<void>
  copyZip: (asset: InspectedPackFile) => Promise<string>
  remove: (paths: string[]) => Promise<void>
}

/** Preserve the uploaded ZIP unchanged; cover and preview images are display-only. */
export async function createAssetPack(attachments: InspectedPackFile[], directory: string, storage: PackStorage) {
  const invalid = validateAssetPackFiles(attachments)
  if (invalid) throw new Error(invalid)
  const written: string[] = []
  const finalized: PackAttachment[] = []
  let previewIndex = 0
  try {
    for (const asset of attachments) {
      if (asset.role === 'download') {
        const path = await storage.copyZip(asset)
        written.push(path)
        finalized.push({ path, role: 'download', mediaType: 'file', mime: 'application/zip',
          byteSize: asset.byteSize, altText: asset.altText || 'Download asset pack (ZIP)', focalX: 50, focalY: 50 })
        continue
      }
      const thumbnail = await createImageThumbnail(await storage.read(asset))
      const path = asset.role === 'cover' ? `${directory}/thumbnail.webp` : `${directory}/previews/${++previewIndex}.webp`
      written.push(path)
      await storage.putImage(path, thumbnail.data)
      finalized.push({ path, role: asset.role, mediaType: 'image', mime: 'image/webp', byteSize: thumbnail.data.length,
        width: thumbnail.width, height: thumbnail.height, altText: asset.altText, focalX: asset.focalX, focalY: asset.focalY })
    }
    return finalized
  } catch (error) {
    try { await storage.remove(written) } catch { /* Keep the original failure; objects remain private. */ }
    throw error
  }
}
