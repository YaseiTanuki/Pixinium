import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'
import test from 'node:test'
import sharp from 'sharp'
import { unzipSync } from 'fflate'
import { createAssetPack, type InspectedPackImage } from '../server/services/asset-pack'
import { validateAssetPackFiles, packEntryName } from '../lib/admin/asset-pack'
import { ASSET_PACK_LIMITS } from '../lib/admin/limits'
import { parseCategoryMetadata } from '../lib/entities/metadata'

function attachment(index: number, role: 'cover' | 'download' = 'download'): InspectedPackImage {
  return { path: `00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-${String(index).padStart(12, '0')}.png`,
    role, fileName: '../same.png', altText: `Image ${index}`, focalX: 50, focalY: 50, byteSize: 1, etag: 'fixture' }
}

test('asset packs require a separate thumbnail, images only, and a bounded image count', () => {
  const cover = attachment(0, 'cover')
  const image = attachment(1)
  assert.equal(validateAssetPackFiles([cover, image]), undefined)
  for (const invalid of [[], [image], [cover], [cover, cover, image],
    [cover, { ...image, path: image.path.replace('.png', '.zip') }],
    [cover, ...Array.from({ length: ASSET_PACK_LIMITS.images + 1 }, (_, index) => attachment(index + 1))]]) {
    assert.ok(validateAssetPackFiles(invalid))
  }
  assert.deepEqual(parseCategoryMetadata('assets.v1', { image_count: 2 }), { image_count: 2 })
  assert.throws(() => parseCategoryMetadata('assets.v1', { image_count: 0 }))
})

test('ZIP names are flat, unique and keep the validated extension', () => {
  for (const fileName of ['../../CON.png', 'C:\\folder\\same.png', 'same.png', 'a.png.exe', '..', '']) {
    const asset = { ...attachment(1), fileName }
    const first = packEntryName(asset, 0)
    assert.ok(!first.includes('/') && !first.includes('\\') && !first.includes('..'))
    assert.ok(first.endsWith('.png'))
    assert.notEqual(first, packEntryName(asset, 1))
  }
})

test('pack ZIP includes every original, excludes the cover, and stores at most five previews', async () => {
  const coverBytes = await sharp({ create: { width: 12, height: 8, channels: 3, background: '#ff0000' } }).png().toBuffer()
  const imageBytes = await sharp({ create: { width: 20, height: 12, channels: 3, background: '#00ff00' } }).png().toBuffer()
  const images = Array.from({ length: ASSET_PACK_LIMITS.previews + 2 }, (_, index) => attachment(index + 1))
  const stored = new Map<string, Uint8Array>()
  let localFile = ''
  const result = await createAssetPack([attachment(0, 'cover'), ...images], 'assets/1', {
    read: async asset => asset.role === 'cover' ? coverBytes : imageBytes,
    putImage: async (path, bytes) => { stored.set(path, bytes) },
    putZip: async (path, file, size) => {
      localFile = file
      const bytes = await readFile(file)
      assert.equal(bytes.length, size)
      stored.set(path, bytes)
    },
    remove: async () => { assert.fail('Successful pack must not be removed') },
  })
  const zip = unzipSync(stored.get('assets/1/pack.zip')!)
  assert.equal(Object.keys(zip).length, images.length)
  for (const bytes of Object.values(zip)) assert.deepEqual(Buffer.from(bytes), imageBytes)
  assert.deepEqual(result.filter(asset => asset.role === 'preview').map(asset => asset.altText), images.slice(0, 5).map(asset => asset.altText))
  assert.equal(result.filter(asset => asset.role === 'cover').length, 1)
  assert.equal(result.filter(asset => asset.role === 'download').length, 1)
  for (const asset of result.filter(asset => asset.role !== 'download')) {
    assert.equal((await sharp(stored.get(asset.path)).metadata()).format, 'webp')
  }
  await assert.rejects(access(localFile))
})

test('a corrupt image beyond the preview limit aborts publishing and cleans generated objects', async () => {
  const valid = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } }).png().toBuffer()
  const inputs = [attachment(0, 'cover'), ...Array.from({ length: 6 }, (_, index) => attachment(index + 1))]
  const written: string[] = []
  let removed: string[] = []
  await assert.rejects(createAssetPack(inputs, 'assets/2', {
    read: async asset => asset === inputs.at(-1) ? Buffer.from('not an image') : valid,
    putImage: async path => { written.push(path) },
    putZip: async () => { assert.fail('Invalid pack cannot be uploaded') },
    remove: async paths => { removed = [...paths] },
  }))
  assert.deepEqual(removed, written)
  assert.equal(removed.length, 6)
})

test('ZIP upload failure removes the ZIP and generated display images', async () => {
  const valid = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } }).png().toBuffer()
  let localFile = ''
  let removed: string[] = []
  await assert.rejects(createAssetPack([attachment(0, 'cover'), attachment(1)], 'assets/3', {
    read: async () => valid,
    putImage: async () => {},
    putZip: async (_path, file) => { localFile = file; throw new Error('Storage unavailable') },
    remove: async paths => { removed = [...paths] },
  }), /Storage unavailable/)
  assert.deepEqual(removed, ['assets/3/thumbnail.webp', 'assets/3/previews/1.webp', 'assets/3/pack.zip'])
  await assert.rejects(access(localFile))
})
