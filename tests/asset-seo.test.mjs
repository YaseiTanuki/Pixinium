import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const source = ts.transpileModule(readFileSync(new URL('../app/api/assets/[id]/route.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function fixture(row = { bucket: 'assets', object_path: 'original.png', media_type: 'image', mime_type: 'image/png', download: true, image_only: true }) {
  const counts = { downloads: 0, streams: 0, redirects: 0, inspections: 0 }
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  const sql = async (parts) => {
    if (parts.join('').includes('UPDATE catalog.items')) { counts.downloads++; return [] }
    return row ? [row] : []
  }
  const exports = {}
  runInNewContext(source, { exports, process: { env: { DATABASE_URL: 'fixture-only' } }, Response, URL,
    require(name) {
      if (name === '@/lib/database') return { createDatabase: () => sql }
      if (name === 'next/server') return { NextResponse: Response }
      if (name === '@/lib/content-types') return { CONTENT_SCHEMAS: { image: 'images.v1' } }
      if (name === '@/server/services/storage.service') return {
        adminStorage: () => ({ bucket: 'assets' }),
        signDownload: async () => { counts.redirects++; return 'https://storage.invalid/signed' },
        inspectStoredFile: async () => { counts.inspections++; return { ETag: '"original-v1"', ContentLength: bytes.length, LastModified: new Date('2026-11-05T12:00:00Z') } },
        readStoredStream: async (_path, range) => { counts.streams++; return {
          ETag: '"original-v1"', LastModified: new Date('2026-11-05T12:00:00Z'),
          Body: { transformToWebStream: () => new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close() } }) },
          ContentLength: bytes.length, ...(range ? { ContentRange: 'bytes 0-7/8' } : {}),
        } },
      }
      throw new Error(`Unexpected fixture import: ${name}`)
    },
  })
  const get = (query = '', headers = {}) => exports.GET(new Request(`https://pixinium.invalid/api/assets/1${query}`, { headers }), { params: Promise.resolve({ id: '1' }) })
  const head = (query = '', headers = {}) => exports.HEAD(new Request(`https://pixinium.invalid/api/assets/1${query}`, { method: 'HEAD', headers }), { params: Promise.resolve({ id: '1' }) })
  return { get, head, counts, bytes }
}

test('original image view streams unchanged bytes inline, is indexable and does not count a download', async () => {
  const f = fixture()
  const response = await f.get('?view=1')
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-disposition'), 'inline')
  assert.equal(response.headers.get('x-robots-tag'), null)
  assert.equal(response.headers.get('location'), null)
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), f.bytes)
  assert.equal(f.counts.downloads, 0)
  const partial = await f.get('?view=1', { range: 'bytes=0-7' })
  assert.equal(partial.status, 206)
  assert.equal(partial.headers.get('x-robots-tag'), null)
})

test('ordinary original download remains an attachment and counts the download', async () => {
  const f = fixture()
  const response = await f.get()
  assert.equal(response.headers.get('content-disposition'), 'attachment')
  assert.equal(response.headers.get('x-robots-tag'), null)
  assert.equal(f.counts.downloads, 1)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
})

test('Images thumbnails put noindex on the actual response rather than a signed redirect', async () => {
  const f = fixture({ bucket: 'assets', object_path: 'thumbnail.webp', media_type: 'image', mime_type: 'image/webp', download: false, image_only: true })
  const response = await f.get()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('x-robots-tag'), 'noindex')
  assert.equal(response.headers.get('location'), null)
  assert.equal(response.headers.get('content-disposition'), 'inline')
  assert.equal(f.counts.redirects, 0)
  assert.equal(f.counts.downloads, 0)
})

test('inline viewing does not bypass media type, publication or range validation', async () => {
  const audio = fixture({ bucket: 'assets', object_path: 'track.mp3', media_type: 'audio', mime_type: 'audio/mpeg', download: true, image_only: false })
  assert.equal((await audio.get('?view=1')).status, 404)
  assert.equal((await audio.get('?play=1')).headers.get('content-disposition'), 'inline')
  assert.equal(audio.counts.downloads, 0)
  assert.equal((await fixture(null).get('?view=1')).status, 404)
  assert.equal((await fixture().get('?view=1', { range: 'bytes=0-1,4-5' })).status, 416)
})

test('covers for other categories stream inline at stable indexable URLs', async () => {
  const f = fixture({ bucket: 'assets', object_path: 'cover.webp', media_type: 'image', mime_type: 'image/webp', download: false, image_only: false })
  const response = await f.get()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('location'), null)
  assert.equal(response.headers.get('x-robots-tag'), null)
  assert.equal(response.headers.get('content-disposition'), 'inline')
  assert.equal(response.headers.get('cache-control'), 'private, no-cache')
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), f.bytes)
  assert.equal(f.counts.redirects, 0)
  assert.equal(f.counts.downloads, 0)
})

test('image ETags allow reuse without transferring a body, only after checking current public access', async () => {
  const f = fixture()
  const first = await f.get('?view=1')
  assert.equal(first.headers.get('etag'), '"original-v1"')
  assert.equal(first.headers.get('cache-control'), 'private, no-cache')
  for (const etag of ['"original-v1"', 'W/"original-v1"', '"old", "original-v1"', '*']) {
    const response = await f.get('?view=1', { 'if-none-match': etag })
    assert.equal(response.status, 304)
    assert.equal((await response.arrayBuffer()).byteLength, 0)
    assert.equal(response.headers.get('etag'), '"original-v1"')
  }
  assert.equal(f.counts.streams, 1)
  assert.equal((await f.get('?view=1', { 'if-none-match': '"old"' })).status, 200)
  const hidden = fixture(null)
  const denied = await hidden.get('?view=1', { 'if-none-match': '"original-v1"' })
  assert.equal(denied.status, 404)
  assert.equal(denied.headers.get('cache-control'), 'private, no-store')
  assert.equal(hidden.counts.inspections, 0)
  const wrongBucket = fixture({ bucket: 'other', download: true, media_type: 'image' })
  assert.equal((await wrongBucket.get('?view=1', { 'if-none-match': '*' })).status, 404)
  const thumb = fixture({ bucket: 'assets', object_path: 'thumb.webp', media_type: 'image', mime_type: 'image/webp', download: false, image_only: true })
  assert.equal((await thumb.get('', { 'if-none-match': '*' })).headers.get('x-robots-tag'), 'noindex')
})

test('HEAD checks public access and returns file headers without reading bytes or counting a download', async () => {
  const f = fixture()
  const response = await f.head()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-length'), String(f.bytes.length))
  assert.equal(response.headers.get('content-disposition'), 'attachment')
  assert.equal((await response.arrayBuffer()).byteLength, 0)
  assert.equal(f.counts.streams, 0)
  assert.equal(f.counts.downloads, 0)
  assert.equal((await f.head('?view=1', { 'if-none-match': '"original-v1"' })).status, 304)
  assert.equal((await fixture(null).head()).status, 404)
})
