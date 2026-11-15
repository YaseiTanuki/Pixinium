import assert from 'node:assert/strict'
import test from 'node:test'
import sharp from 'sharp'
import { zipSync, strToU8 } from 'fflate'
import { createAssetPack, type InspectedPackFile } from '../server/services/asset-pack'
import { validateAssetPackFiles } from '../lib/admin/asset-pack'
import { ASSET_PACK_LIMITS } from '../lib/admin/limits'
import { parseCategoryMetadata } from '../lib/entities/metadata'

function attachment(index: number, role: 'cover' | 'preview' | 'download'): InspectedPackFile {
  return { path: `00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-${String(index).padStart(12, '0')}.${role === 'download' ? 'zip' : 'png'}`,
    role, fileName: role === 'download' ? 'my-assets.zip' : 'image.png', altText: `File ${index}`, focalX: 50, focalY: 50, byteSize: 1, etag: 'fixture' }
}

test('asset packs require one ZIP, a cover and at most five optional image previews', () => {
  const cover = attachment(0, 'cover'), zip = attachment(1, 'download'), preview = attachment(2, 'preview')
  assert.equal(validateAssetPackFiles([cover, zip]), undefined)
  assert.equal(validateAssetPackFiles([cover, zip, preview]), undefined)
  assert.equal(validateAssetPackFiles([cover, zip, ...Array.from({ length: 5 }, (_, i) => attachment(i + 2, 'preview'))]), undefined)
  for (const invalid of [[], [zip], [cover], [cover, preview], [cover, cover, zip], [cover, zip, attachment(3, 'download')],
    [cover, { ...zip, path: zip.path.replace('.zip', '.png') }],
    [{ ...cover, path: cover.path.replace('.png', '.zip') }, zip],
    [cover, zip, { ...preview, path: preview.path.replace('.png', '.zip') }],
    [cover, zip, ...Array.from({ length: ASSET_PACK_LIMITS.previews + 1 }, (_, i) => attachment(i + 2, 'preview'))]]) {
    assert.ok(validateAssetPackFiles(invalid))
  }
  assert.deepEqual(parseCategoryMetadata('assets.v1', {}), {})
  assert.throws(() => parseCategoryMetadata('assets.v1', { image_count: 2 }))
})

test('uploaded ZIP stays byte-identical and preview images are stored separately', async () => {
  const image = await sharp({ create: { width: 20, height: 12, channels: 3, background: '#0f0' } }).png().toBuffer()
  const zip = zipSync({ 'nested/readme.txt': strToU8('Original archive content'), 'font.otf': new Uint8Array([0, 1, 2, 3]) })
  const inputs = [attachment(0, 'cover'), { ...attachment(1, 'download'), byteSize: zip.length }, attachment(2, 'preview'), attachment(3, 'preview')]
  const stored = new Map<string, Uint8Array>()
  const result = await createAssetPack(inputs, 'assets/1', {
    read: async asset => { assert.notEqual(asset.role, 'download'); return image },
    putImage: async (path, bytes) => { stored.set(path, bytes) },
    copyZip: async asset => { assert.equal(asset.etag, 'fixture'); const path = 'assets/1/originals/archive.zip'; stored.set(path, zip); return path },
    remove: async () => assert.fail('Successful upload must not be removed'),
  })
  assert.deepEqual(stored.get('assets/1/originals/archive.zip'), zip)
  assert.deepEqual(result.map(a => a.role), ['cover', 'download', 'preview', 'preview'])
  assert.equal(result.find(a => a.role === 'download')!.byteSize, zip.length)
  assert.deepEqual(result.filter(a => a.role === 'preview').map(a => a.altText), ['File 2', 'File 3'])
  for (const asset of result.filter(a => a.role !== 'download')) {
    assert.equal((await sharp(stored.get(asset.path)).metadata()).format, 'webp')
  }
})

test('ZIP with no preview inputs does not generate previews', async () => {
  const image = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } }).png().toBuffer()
  const result = await createAssetPack([attachment(0, 'cover'), attachment(1, 'download')], 'assets/2', {
    read: async () => image, putImage: async () => {}, copyZip: async () => 'assets/2/originals/archive.zip', remove: async () => {},
  })
  assert.deepEqual(result.map(a => a.role), ['cover', 'download'])
})

test('corrupt preview cleans the copied ZIP and earlier display files', async () => {
  const image = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } }).png().toBuffer()
  let removed: string[] = []
  await assert.rejects(createAssetPack([attachment(0, 'cover'), attachment(1, 'download'), attachment(2, 'preview')], 'assets/3', {
    read: async asset => asset.role === 'preview' ? Buffer.from('not an image') : image,
    putImage: async () => {}, copyZip: async () => 'assets/3/originals/archive.zip', remove: async paths => { removed = [...paths] },
  }))
  assert.deepEqual(removed, ['assets/3/thumbnail.webp', 'assets/3/originals/archive.zip'])
})

test('ZIP copy failure stops saving and cleans generated display files', async () => {
  const image = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } }).png().toBuffer()
  let removed: string[] = []
  await assert.rejects(createAssetPack([attachment(0, 'cover'), attachment(1, 'download')], 'assets/4', {
    read: async () => image, putImage: async () => {}, copyZip: async () => { throw new Error('Storage unavailable') },
    remove: async paths => { removed = [...paths] },
  }), /Storage unavailable/)
  assert.deepEqual(removed, ['assets/4/thumbnail.webp'])
})
