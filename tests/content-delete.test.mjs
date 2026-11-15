import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { PGlite } from '@electric-sql/pglite'
import { createDatabase } from '../lib/database.ts'
import { migrate } from '../scripts/migrations.ts'
import * as queries from '../server/repositories/content-delete.ts'
import { createContentQuery } from '../server/repositories/content-write.ts'

test('storage failure retains item and assets; retry deletes exclusive files before committing', async t => {
  const db = new PGlite()
  t.after(() => db.close())
  await migrate({ query: async (sql, values) => values ? db.query(sql, values) : (await db.exec(sql)).at(-1) })
  const admin = '00000000-0000-4000-8000-000000000001'
  const member = '00000000-0000-4000-8000-000000000002'
  await db.query("INSERT INTO catalog.profiles(id,role) VALUES ($1,'admin'),($2,'member')", [admin, member])
  const { rows: [category] } = await db.query("SELECT id,metadata_schema_key FROM catalog.categories WHERE slug='games'")
  const paths = ['agents/test/items/23/game.zip', 'agents/test/items/23/thumbnail.webp', 'shared.webp']
  const attachments = paths.map((path, i) => ({ path, role: i === 0 ? 'download' : 'cover',
    mediaType: i === 0 ? 'file' : 'image', mime: i === 0 ? 'application/zip' : 'image/webp', byteSize: 100,
    altText: 'Game', focalX: 50, focalY: 50 }))
  // Use one cover per item; link the shared artwork separately below.
  const { rows: [item] } = await db.query(createContentQuery, [admin, category.id, category.metadata_schema_key,
    JSON.stringify({ slug: 'delete-game', title: 'Game', summary: '', description: '', status: 'published',
      accentColor: '#ffffff', metadata: {}, tags: [], facts: [], attachments: attachments.slice(0, 2) }), 'pixinium'])
  const { rows: [other] } = await db.query(createContentQuery, [admin, category.id, category.metadata_schema_key,
    JSON.stringify({ slug: 'survivor', title: 'Survivor', summary: '', description: '', status: 'published',
      accentColor: '#ffffff', metadata: {}, tags: [], facts: [], attachments: [attachments[2]] }), 'pixinium'])
  await db.query(`INSERT INTO catalog.item_assets(item_id,asset_id,role)
    SELECT $1,asset_id,'preview' FROM catalog.item_assets WHERE item_id=$2`, [item.id, other.id])
  const source = ts.transpileModule(readFileSync(new URL('../server/services/content-delete.service.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  let closes = 0
  const database = createDatabase('fixture', () => ({ connect: async () => {}, end: async () => { closes++ },
    query: (sql, values) => db.query(sql, values) }))
  const stored = new Set(paths)
  let fail = true
  let storageCalls = 0
  const invalidations = []
  const exports = {}
  const mocks = {
    'server-only': {},
    '@/lib/database': { createDatabase: () => database },
    'next/cache': { revalidatePath: path => invalidations.push(path) },
    '@/lib/auth/permissions': { hasPermission: role => role === 'admin' },
    '@/lib/agent-identity': { isAgentActor: actor => actor.kind === 'agent' },
    '@/lib/auth/errors': { authDiagnostic: () => ({}) },
    '@/server/repositories/content-delete': queries,
    './storage.service': { deleteStoredContent: async assets => {
      storageCalls++
      assert.equal((await db.query('SELECT 1 FROM catalog.items WHERE id=$1', [item.id])).rows.length, 1)
      assert.deepEqual(assets.map(a => a.object_path).sort(), paths.slice(0, 2).sort())
      stored.delete(paths[0])
      if (fail) throw new Error('R2 unavailable after deleting one file')
      for (const asset of assets) stored.delete(asset.object_path)
    } },
  }
  runInNewContext(source, { exports, process: { env: { CATALOG_ADMIN_DATABASE_URL: 'fixture' } },
    console: { error() {} }, require: name => {
      if (name in mocks) return mocks[name]
      throw new Error(`Unexpected import: ${name}`)
    } })
  const remove = id => exports.deleteContentForActor({ id, role: 'admin' }, item.id)
  assert.ok((await remove(member)).error)
  assert.equal(storageCalls, 0)
  const failed = await remove(admin)
  assert.match(failed.error, /kept so you can retry/)
  assert.equal(failed.message, undefined)
  assert.equal((await db.query('SELECT 1 FROM catalog.items WHERE id=$1', [item.id])).rows.length, 1)
  assert.equal((await db.query('SELECT 1 FROM catalog.item_assets WHERE item_id=$1', [item.id])).rows.length, 3)
  assert.equal((await db.query('SELECT 1 FROM catalog.assets')).rows.length, 3)
  assert.equal(invalidations.length, 0)
  assert.ok(!stored.has(paths[0]))
  fail = false
  assert.equal((await remove(admin)).message, 'Content deleted.')
  assert.equal((await db.query('SELECT 1 FROM catalog.items WHERE id=$1', [item.id])).rows.length, 0)
  assert.equal((await db.query('SELECT 1 FROM catalog.assets')).rows.length, 1)
  assert.deepEqual([...stored], [paths[2]])
  assert.ok(invalidations.includes('/items/games/delete-game'))
  assert.ok((await remove(admin)).error)
  assert.equal(storageCalls, 2)
  assert.equal(closes, 4)
})
