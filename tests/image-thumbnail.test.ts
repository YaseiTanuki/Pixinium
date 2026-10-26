import assert from 'node:assert/strict'
import test from 'node:test'
import sharp from 'sharp'
import { createImageThumbnail } from '../server/services/image-thumbnail'

test('thumbnail is reduced WebP while the original bytes remain intact', async () => {
  const original = await sharp({ create: { width: 2400, height: 1600, channels: 3, background: '#d95845' } }).png().toBuffer()
  const before = Buffer.from(original)
  const result = await createImageThumbnail(original)
  assert.deepEqual(original, before)
  assert.equal(result.originalMime, 'image/png')
  assert.equal(result.originalWidth, 2400)
  assert.equal(result.originalHeight, 1600)
  assert.equal(result.width, 800)
  assert.equal(result.height, 533)
  assert.equal((await sharp(result.data).metadata()).format, 'webp')
  assert.ok(result.data.length < original.length)
})

test('thumbnail preserves portrait proportions and does not upscale small images', async () => {
  for (const [width, height, expectedWidth, expectedHeight] of [[1200, 2400, 400, 800], [100, 60, 100, 60]]) {
    const input = await sharp({ create: { width, height, channels: 4, background: '#12345680' } }).png().toBuffer()
    const result = await createImageThumbnail(input)
    assert.equal(result.width, expectedWidth)
    assert.equal(result.height, expectedHeight)
  }
})

test('thumbnail rejects invalid data and active SVG documents', async () => {
  await assert.rejects(createImageThumbnail(Buffer.from('not an image')))
  await assert.rejects(createImageThumbnail(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>')))
})


test('image facts use the displayed resolution for EXIF rotated originals', async () => {
  const original = await sharp({ create: { width: 120, height: 80, channels: 3, background: '#123456' } })
    .jpeg().withMetadata({ orientation: 6 }).toBuffer()
  const result = await createImageThumbnail(original)
  assert.equal(result.originalWidth, 80)
  assert.equal(result.originalHeight, 120)
  assert.equal(result.originalMime, 'image/jpeg')
})
