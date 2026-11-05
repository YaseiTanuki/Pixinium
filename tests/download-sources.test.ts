import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { migrate, readMigrations } from '../scripts/migrations'
import { downloadSourcesSchema, readDownloadSources, downloadSourcesFromForm, resolveDownloadSources, validateSourceLinks, type DownloadProvider } from '../lib/download-sources'
import { contentUpdateSchema } from '../lib/admin/content'
import { createContentQuery } from '../server/repositories/content-write'
import { editableContentQuery, updateContentStatements } from '../server/repositories/content-edit'
import { cardsQuery } from '../server/repositories/catalog.queries'
import { managedDownloadProvidersQuery, createDownloadProviderQuery, updateDownloadProviderQuery, deleteDownloadProviderQuery } from '../server/repositories/download-sources'

const github = { provider: 'github', url: 'https://github.com/pixinium/archive' }
const archive = { provider: 'internet_archive', url: 'https://archive.org/details/pixinium' }
const providers: DownloadProvider[] = [
  { slug: 'github', name: 'GitHub', kind: 'external', hostname: 'github.com', priority: 1, isActive: true },
  { slug: 'internet_archive', name: 'Internet Archive', kind: 'external', hostname: 'archive.org', priority: 2, isActive: true },
  { slug: 'pixinium', name: 'Pixinium', kind: 'internal', hostname: null, priority: 3, isActive: true },
]
const admin = '00000000-0000-4000-8000-000000000001'
const member = '00000000-0000-4000-8000-000000000002'

test('configured priorities choose the primary, including Pixinium, and disabled sources disappear', () => {
  const order = (definitions: DownloadProvider[], links = [archive, github], files = true) => resolveDownloadSources(links, definitions, files).map(source => source.provider)
  assert.deepEqual(order(providers), ['github', 'internet_archive', 'pixinium'])
  assert.deepEqual(order(providers.map(source => source.slug === 'pixinium' ? { ...source, priority: 0 } : source)), ['pixinium', 'github', 'internet_archive'])
  assert.deepEqual(order(providers.map(source => ({ ...source, isActive: source.slug !== 'github' }))), ['internet_archive', 'pixinium'])
  assert.deepEqual(order(providers, [github], false), ['github'])
  assert.deepEqual(order(providers, [], false), [])
  const custom = { slug: 'custom', name: 'Custom mirror', kind: 'external' as const, hostname: 'example.org', priority: 0, isActive: true }
  assert.deepEqual(order([...providers, custom], [{ provider: 'custom', url: 'https://example.org/file' }]), ['custom', 'pixinium'])
})

test('source URL validation is generic, enforces registry domains and retains unchanged disabled links', () => {
  for (const url of ['javascript:alert(1)', 'invalid', 'http://github.com/a/b', 'https://user:pass@github.com/a/b', 'https://github.com:1234/a/b']) {
    assert.equal(downloadSourcesSchema.safeParse([{ ...github, url }]).success, false)
    assert.deepEqual(readDownloadSources([{ ...github, url }]), [])
  }
  assert.equal(downloadSourcesSchema.safeParse([github, github]).success, false)
  assert.equal(validateSourceLinks([github], providers), null)
  assert.ok(validateSourceLinks([{ ...github, url: 'https://github.com.evil.test/a/b' }], providers))
  assert.ok(validateSourceLinks([{ provider: 'unknown', url: 'https://example.org/a' }], providers))
  const disabled = providers.map(source => ({ ...source, isActive: false }))
  assert.ok(validateSourceLinks([github], disabled))
  assert.equal(validateSourceLinks([github], disabled, [github]), null)
  const form = new FormData(); form.set('download_custom', ' https://example.org/file '); form.set('title', 'Ignored')
  assert.deepEqual(downloadSourcesFromForm(form), [{ provider: 'custom', url: 'https://example.org/file' }])
  const text = { title: 'Item', summary: '', description: '', tags: [], facts: [] }
  assert.equal(contentUpdateSchema.parse({ id: '1', ...text }).downloadSources, undefined)
  assert.deepEqual(contentUpdateSchema.parse({ id: '1', ...text, downloadSources: [] }).downloadSources, [])
})

test('registry CRUD, relational links, authorization and public visibility round trip', { timeout: 30000 }, async () => {
  const db = new PGlite()
  try {
    await migrate({ query: async (sql, values) => values ? db.query(sql, values) : (await db.exec(sql)).at(-1) })
    await db.query(`INSERT INTO catalog.profiles(id,role) VALUES($1,'admin'),($2,'member')`, [admin, member])
    const category = (await db.query<{ id: string; slug: string; metadata_schema_key: string }>('SELECT id::text,slug,metadata_schema_key FROM catalog.categories ORDER BY id LIMIT 1')).rows[0]
    const text = { title: 'Sources', summary: 'Summary', description: '', facts: [], tags: [] }
    const doc = { ...text, slug: 'sources', status: 'published', accentColor: '#ffffff', isFeatured: false, sortOrder: 0, attachments: [], metadata: {}, downloadSources: [archive, github] }
    const { id } = (await db.query<{ id: string }>(createContentQuery, [admin, category.id, category.metadata_schema_key, JSON.stringify(doc), 'assets'])).rows[0]
    const links = async () => readDownloadSources((await db.query<{ download_sources: unknown }>(editableContentQuery, [id])).rows[0].download_sources)
    assert.deepEqual(await links(), [github, archive])
    assert.deepEqual(readDownloadSources((await db.query<{ download_sources: unknown }>(cardsQuery, [category.slug, 'sources', null])).rows[0].download_sources), [github, archive])
    assert.equal((await db.query(createDownloadProviderQuery, [member, 'other', 'Other', 'example.org', 0, true])).rows.length, 0)
    await db.query(createDownloadProviderQuery, [admin, 'other', 'Other', 'example.org', 0, true])
    const edit = async (changes: object, metadata?: object) => db.transaction(async tx => {
      for (const [sql, values] of updateContentStatements({ actor: admin, id, text: { ...text, ...changes }, editFacts: true,
        ...(metadata ? { files: { oldAssetIds: [], attachments: [], bucket: 'assets', metadata } } : {}) })) await tx.query(sql, values)
    })
    await edit({}, { image_count: 2 }); assert.deepEqual(await links(), [github, archive])
    await edit({ downloadSources: [{ provider: 'other', url: 'https://example.org/file' }, github] })
    await assert.rejects(db.query(deleteDownloadProviderQuery, [admin, 'other']), /foreign key/)
    await assert.rejects(db.query(updateDownloadProviderQuery, [admin, 'other', 'Other', 'new.example.org', 0, true]), /Domain cannot change/)
    await db.query(updateDownloadProviderQuery, [admin, 'github', 'Git mirror', 'github.com', 8, false])
    await edit({ downloadSources: [github] }) // existing disabled URL can be kept
    await assert.rejects(edit({ downloadSources: [{ ...github, url: 'https://github.com/new/repo' }] }), /disabled/)
    await assert.rejects(edit({ downloadSources: [{ provider: 'other', url: 'https://evil.test/file' }] }), /configured source domain/)
    await edit({ downloadSources: [] }); assert.deepEqual(await links(), [])
    assert.equal((await db.query(deleteDownloadProviderQuery, [admin, 'other'])).rows.length, 1)
    assert.equal((await db.query(deleteDownloadProviderQuery, [admin, 'pixinium'])).rows.length, 0)
    const definitions = (await db.query<DownloadProvider>(managedDownloadProvidersQuery)).rows
    assert.equal(definitions.find(source => source.slug === 'github')?.priority, 8)
    await db.exec('CREATE ROLE download_test_reader NOLOGIN; GRANT USAGE ON SCHEMA catalog TO download_test_reader; GRANT SELECT ON catalog.items,catalog.categories,catalog.download_sources,catalog.item_download_sources TO download_test_reader; SET ROLE download_test_reader;')
    assert.equal((await db.query('SELECT * FROM catalog.download_sources WHERE slug=$1', ['github'])).rows.length, 0)
    await assert.rejects(db.query("UPDATE catalog.download_sources SET priority=0"), /permission denied/)
    await db.exec('RESET ROLE')
    await db.query('DELETE FROM catalog.items WHERE id=$1', [id])
    assert.equal((await db.query('SELECT * FROM catalog.item_download_sources WHERE item_id=$1', [id])).rows.length, 0)
  } finally { await db.close() }
})

test('migration preserves metadata links before removing their old storage', { timeout: 30000 }, async () => {
  const db = new PGlite()
  try {
    for (const migration of await readMigrations()) {
      if (migration.name >= '0022') break
      await db.transaction(async tx => { await tx.exec(migration.sql) })
    }
    const { id } = (await db.query<{ id: string }>(`INSERT INTO catalog.items(category_id,slug,title,status,metadata) SELECT id,'legacy-sources','Legacy','draft',$1::jsonb FROM catalog.categories ORDER BY id LIMIT 1 RETURNING id::text`, [JSON.stringify({ download_sources: [archive, github] })])).rows[0]
    await db.exec(await readFile('db/migrations/0022_download_sources.sql', 'utf8'))
    assert.equal((await db.query('SELECT * FROM catalog.item_download_sources WHERE item_id=$1', [id])).rows.length, 2)
    assert.deepEqual((await db.query<{ metadata: object }>('SELECT metadata FROM catalog.items WHERE id=$1', [id])).rows[0].metadata, {})
  } finally { await db.close() }
})
