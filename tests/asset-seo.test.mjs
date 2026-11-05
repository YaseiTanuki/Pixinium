import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const source = ts.transpileModule(readFileSync(new URL('../app/api/assets/[id]/route.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function fixture(row = { bucket: 'assets', object_path: 'original.png', media_type: 'image', mime_type: 'image/png', download: true, image_only: true }) {
  const counts = { downloads: 0, streams: 0, redirects: 0 }
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  const sql = async (parts) => {
    if (parts.join('').includes('UPDATE catalog.items')) { counts.downloads++; return [] }
    return row ? [row] : []
  }
  const exports = {}
  runInNewContext(source, { exports, process: { env: { DATABASE_URL: 'fixture-only' } }, Response, URL,
    require(name) {
      if (name === '@neondatabase/serverless') return { neon: () => sql }
      if (name === 'next/server') return { NextResponse: Response }
      if (name === '@/lib/content-types') return { CONTENT_SCHEMAS: { image: 'images.v1' } }
      if (name === '@/server/services/storage.service') return {
        adminStorage: () => ({ bucket: 'assets' }),
        signDownload: async () => { counts.redirects++; return 'https://storage.invalid/signed' },
        readStoredStream: async (_path, range) => { counts.streams++; return {
          Body: { transformToWebStream: () => new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close() } }) },
          ContentLength: bytes.length, ...(range ? { ContentRange: 'bytes 0-7/8' } : {}),
        } },
      }
      throw new Error(`Unexpected fixture import: ${name}`)
    },
  })
  const get = (query = '', headers = {}) => exports.GET(new Request(`https://pixinium.invalid/api/assets/1${query}`, { headers }), { params: Promise.resolve({ id: '1' }) })
  return { get, counts, bytes }
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
