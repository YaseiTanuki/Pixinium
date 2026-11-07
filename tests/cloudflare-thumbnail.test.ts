import assert from 'node:assert/strict'
import test from 'node:test'
import { createCloudflareImageThumbnail, type ThumbnailImagesBinding } from '../server/services/image-thumbnail.cloudflare'

test('Workers thumbnails preserve originals and use transformed dimensions', async () => {
  const original = Uint8Array.from([1, 2, 3])
  let reads = 0
  const images: ThumbnailImagesBinding = {
    async info() {
      return reads++ === 0 ? { format: 'image/jpeg', width: 1200, height: 2400 }
        : { format: 'image/webp', width: 400, height: 800 }
    },
    input(stream) {
      return { transform(options) {
        assert.deepEqual(options, { width: 800, height: 800, fit: 'scale-down' })
        return { async output(options) {
          assert.deepEqual(new Uint8Array(await new Response(stream).arrayBuffer()), original)
          assert.deepEqual(options, { format: 'image/webp', quality: 80, anim: false })
          return { response: () => new Response(Uint8Array.from([4, 5])) }
        } }
      } }
    },
  }
  const result = await createCloudflareImageThumbnail(original, images)
  assert.equal(result.originalMime, 'image/jpeg')
  assert.equal(result.originalWidth, 1200)
  assert.equal(result.originalHeight, 2400)
  assert.equal(result.width, 400)
  assert.equal(result.height, 800)
  assert.deepEqual(result.data, Buffer.from([4, 5]))
  assert.deepEqual(original, Uint8Array.from([1, 2, 3]))
})

test('Workers thumbnails reject active formats, missing dimensions and oversized rasters before transformation', async () => {
  for (const info of [
    { format: 'image/svg+xml', width: 10, height: 10 },
    { format: 'image/gif', width: 10, height: 10 },
    { format: 'image/png' },
    { format: 'image/png', width: 8001, height: 8000 },
  ]) {
    const images: ThumbnailImagesBinding = {
      info: async () => info,
      input() { throw new Error('Transformation must not run') },
    }
    await assert.rejects(createCloudflareImageThumbnail(new Uint8Array(), images),
      /Unsupported image format|Invalid image dimensions/)
  }
})

test('Workers thumbnails propagate decoder and transformation failures', async () => {
  const images: ThumbnailImagesBinding = {
    async info() { throw new Error('Invalid image bytes') },
    input() { throw new Error('Must not transform undecodable images') },
  }
  await assert.rejects(createCloudflareImageThumbnail(new Uint8Array(), images), /Invalid image bytes/)
  images.info = async () => ({ format: 'image/png', width: 100, height: 60 })
  images.input = () => ({ transform: () => ({ output: async () => ({ response: () => new Response(null, { status: 500 }) }) }) })
  await assert.rejects(createCloudflareImageThumbnail(new Uint8Array(), images), /transformation failed/)
})
