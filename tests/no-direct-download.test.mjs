import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PGlite } from '@electric-sql/pglite'
import { migrate } from '../scripts/migrations.ts'
import { CONTENT_SCHEMAS } from '../lib/content-types.ts'
import { formatByteSize } from '../lib/media-details.ts'

const require = createRequire(import.meta.url)
function load(file, mocks, globals = {}) {
  const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const exports = {}
  runInNewContext(source, { exports, URL, require: name => name in mocks ? mocks[name] : require(name), ...globals })
  return exports
}

test('download actions hide internal links and lock only when no external source is available', () => {
  const { ItemActions } = load('../components/item-detail/shared/item-actions.tsx', {
    'next/image': { default: () => null },
    './save-item-button': { SaveItemButton: () => null },
    '@/lib/media-details': { formatByteSize },
    '@/lib/game-swf': { SWF_MIME: 'application/x-shockwave-flash' },
    '@/lib/content-types': { CONTENT_SCHEMAS },
  })
  const internal = { provider: 'pixinium', name: 'Pixinium', kind: 'internal', priority: 0 }
  const github = { provider: 'github', name: 'GitHub', kind: 'external', priority: 1, url: 'https://github.com/a/b' }
  const archive = { provider: 'archive', name: 'Archive', kind: 'external', priority: 2, url: 'https://archive.org/details/a' }
  const item = { item: { id: '1' }, category: { metadataSchemaKey: CONTENT_SCHEMAS.asset },
    media: [{ id: '1', role: 'download', url: '/api/assets/1', mimeType: 'application/zip' }], noDirectDownload: true }
  const render = sources => renderToStaticMarkup(React.createElement(ItemActions, { item: { ...item, downloadSources: sources } }))
  const locked = render([internal])
  assert.match(locked, /disabled=""/)
  assert.match(locked, /Download not available/)
  assert.ok(!locked.includes('/api/assets/1'))
  const external = render([internal, archive, github])
  assert.ok(!external.includes('/api/assets/1'))
  assert.match(external, /Download on GitHub/)
  assert.ok(external.indexOf(github.url) < external.indexOf(archive.url))
  assert.ok(!external.includes('Download not available'))
  const normal = renderToStaticMarkup(React.createElement(ItemActions, { item: { ...item, noDirectDownload: false, downloadSources: [internal] } }))
  assert.match(normal, /href="\/api\/assets\/1"/)
})

test('asset API checks current published download permission for shared files', async t => {
  const db = new PGlite()
  t.after(() => db.close())
  await migrate({ query: async (sql, values) => values ? db.query(sql, values) : (await db.exec(sql)).at(-1) })
  const { rows: items } = await db.query(`INSERT INTO catalog.items(category_id,slug,title,status,published_at,no_direct_download)
    SELECT c.id,v.slug,v.slug,'published',now(),v.blocked FROM catalog.categories c
    CROSS JOIN (VALUES ('blocked',true),('allowed',false)) v(slug,blocked) WHERE c.slug='assets' RETURNING id::text,slug`)
  const { rows: [asset] } = await db.query(`INSERT INTO catalog.assets(provider,bucket,object_path,media_type,mime_type,byte_size)
    VALUES ('s3','assets','pack.zip','file','application/zip',3) RETURNING id::text`)
  for (const item of items) await db.query("INSERT INTO catalog.item_assets(item_id,asset_id,role) VALUES ($1,$2,'download')", [item.id, asset.id])
  let streams = 0
  const { GET, HEAD } = load('../app/api/assets/[id]/route.ts', {
    '@/lib/database': { createDatabase: () => async (parts, ...values) => (await db.query(parts.reduce((s, part, i) => s + (i ? `$${i}` : '') + part, ''), values)).rows },
    'next/server': { NextResponse: Response },
    '@/lib/content-types': { CONTENT_SCHEMAS },
    '@/lib/game-swf': { SWF_MIME: 'application/x-shockwave-flash' },
    '@/lib/game-download': { gameDownloadZip: () => assert.fail('Asset ZIP must not be repackaged') },
    '@/server/services/storage.service': {
      adminStorage: () => ({ bucket: 'assets' }),
      inspectStoredFile: () => assert.fail('Blocked HEAD must not read storage'),
      readStoredStream: async () => { streams++; return { ContentLength: 3, Body: { transformToWebStream: () => new ReadableStream({ start(c) { c.enqueue(new Uint8Array([1, 2, 3])); c.close() } }) } } },
    },
  }, { process: { env: { DATABASE_URL: 'fixture' } }, Response, URL })
  const context = { params: Promise.resolve({ id: asset.id }) }
  const get = () => GET(new Request(`https://pixinium.test/api/assets/${asset.id}`), context)
  assert.equal((await get()).status, 200) // another published item legitimately exposes the shared asset
  await db.query("UPDATE catalog.items SET status='draft' WHERE slug='allowed'")
  assert.equal((await get()).status, 403)
  assert.equal((await HEAD(new Request(`https://pixinium.test/api/assets/${asset.id}`, { method: 'HEAD' }), context)).status, 403)
  assert.equal(streams, 1)
  await db.query("UPDATE catalog.items SET no_direct_download=false WHERE slug='blocked'")
  assert.equal((await get()).status, 200)
  await db.query("UPDATE catalog.items SET no_direct_download=true WHERE slug='blocked'")
  assert.equal((await get()).status, 403)
  assert.equal(streams, 2)
})
