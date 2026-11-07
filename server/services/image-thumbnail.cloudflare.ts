import { getCloudflareContext } from '@opennextjs/cloudflare'

type ImageInfo = { format: string; width?: number; height?: number }
export interface ThumbnailImagesBinding {
  info(stream: ReadableStream<Uint8Array>): Promise<ImageInfo>
  input(stream: ReadableStream<Uint8Array>): {
    transform(options: { width: number; height: number; fit: 'scale-down' }): {
      output(options: { format: 'image/webp'; quality: number; anim: false }): Promise<{ response(): Response }>
    }
  }
}

/** Uses raw bytes, so private originals never need a public URL. */
export async function createCloudflareImageThumbnail(original: Uint8Array, images: ThumbnailImagesBinding) {
  const stream = (bytes: Uint8Array) => new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(bytes); controller.close() },
  })
  const metadata = await images.info(stream(original))
  const format = metadata.format.replace(/^image\//, '')
  if (!['jpeg', 'png', 'webp', 'avif', 'heif'].includes(format)) throw new Error('Unsupported image format')
  if (!metadata.width || !metadata.height || metadata.width * metadata.height > 64_000_000) {
    throw new Error('Invalid image dimensions or image exceeds the pixel limit')
  }
  const output = await images.input(stream(original))
    .transform({ width: 800, height: 800, fit: 'scale-down' })
    .output({ format: 'image/webp', quality: 80, anim: false })
  const response = output.response()
  if (!response.ok) throw new Error('Image thumbnail transformation failed')
  const data = Buffer.from(await response.arrayBuffer())
  const thumbnail = await images.info(stream(data))
  if (!thumbnail.width || !thumbnail.height) throw new Error('Invalid thumbnail dimensions')
  return { data, width: thumbnail.width, height: thumbnail.height,
    originalWidth: metadata.width, originalHeight: metadata.height,
    originalMime: `image/${format}` }
}

export async function createImageThumbnail(original: Uint8Array) {
  const images = getCloudflareContext().env.IMAGES as ThumbnailImagesBinding | undefined
  if (!images) throw new Error('The Cloudflare Images binding IMAGES is required for thumbnails')
  return createCloudflareImageThumbnail(original, images)
}
