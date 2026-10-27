import { mkdtemp, open, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { Zip, ZipPassThrough } from 'fflate'
import { packEntryName, validateAssetPackFiles } from '../../lib/admin/asset-pack'
import { ASSET_PACK_LIMITS } from '../../lib/admin/limits'
import type { AttachmentInput } from '../../lib/admin/content'
import { createImageThumbnail } from './image-thumbnail'

export type InspectedPackImage = AttachmentInput & { byteSize: number; etag: string }
export type PackAttachment = {
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
  read: (asset: InspectedPackImage) => Promise<Uint8Array>
  putImage: (path: string, data: Uint8Array) => Promise<void>
  putZip: (path: string, localFile: string, size: number) => Promise<void>
  remove: (paths: string[]) => Promise<void>
}

/** Process one original at a time and spool the ZIP to disk, not an in-memory pack. */
export async function createAssetPack(attachments: InspectedPackImage[], directory: string, storage: PackStorage) {
  const invalid = validateAssetPackFiles(attachments)
  if (invalid) throw new Error(invalid)
  const temporary = await mkdtemp(join(tmpdir(), 'pixinium-pack-'))
  const localZip = join(temporary, 'pack.zip')
  const written: string[] = []
  const finalized: PackAttachment[] = []
  try {
    const file = await open(localZip, 'w')
    try {
      // ZipPassThrough emits synchronously; drain each image before loading the next.
      let chunks: Uint8Array[] = []
      const zip = new Zip((error, chunk) => {
        if (error) throw error
        chunks.push(chunk)
      })
      async function flush() {
        for (const chunk of chunks) {
          let offset = 0
          while (offset < chunk.length) {
            const { bytesWritten } = await file.write(chunk, offset, chunk.length - offset)
            if (!bytesWritten) throw new Error('Could not write asset archive')
            offset += bytesWritten
          }
        }
        chunks = []
      }
      let imageIndex = 0
      for (const asset of attachments) {
        const bytes = await storage.read(asset)
        // Decode every image, including those beyond the five displayed previews.
        const thumbnail = await createImageThumbnail(bytes)
        if (asset.role === 'cover' || imageIndex < ASSET_PACK_LIMITS.previews) {
          const path = asset.role === 'cover'
            ? `${directory}/thumbnail.webp`
            : `${directory}/previews/${imageIndex + 1}.webp`
          written.push(path)
          await storage.putImage(path, thumbnail.data)
          finalized.push({ path, role: asset.role === 'cover' ? 'cover' : 'preview',
            mediaType: 'image', mime: 'image/webp', byteSize: thumbnail.data.length,
            width: thumbnail.width, height: thumbnail.height,
            altText: asset.altText, focalX: asset.focalX, focalY: asset.focalY })
        }
        if (asset.role === 'cover') continue
        const entry = new ZipPassThrough(packEntryName(asset, imageIndex))
        zip.add(entry)
        entry.push(bytes, true)
        await flush()
        imageIndex += 1
      }
      zip.end()
      await flush()
    } finally { await file.close() }
    const { size } = await stat(localZip)
    const path = `${directory}/pack.zip`
    written.push(path)
    await storage.putZip(path, localZip, size)
    finalized.push({ path, role: 'download', mediaType: 'file', mime: 'application/zip',
      byteSize: size, altText: 'Download all images (ZIP)', focalX: 50, focalY: 50 })
    return finalized
  } catch (error) {
    try { await storage.remove(written) } catch { /* Keep the original failure; objects remain private. */ }
    throw error
  } finally {
    if (resolve(dirname(temporary)) === resolve(tmpdir()) && basename(temporary).startsWith('pixinium-pack-')) {
      await rm(temporary, { recursive: true, force: true })
    }
  }
}
