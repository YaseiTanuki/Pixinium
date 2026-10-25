import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { contentSchema, fileType } from '../lib/admin/content'
import { parseCategoryMetadata } from '../lib/entities/metadata'
import { createContentQuery } from '../server/repositories/content-write'

const admin = '00000000-0000-4000-8000-000000000001'
const member = '00000000-0000-4000-8000-000000000002'
const item = { categoryId: '1', title: 'New find', slug: 'new-find', summary: 'Summary', description: '',
  status: 'draft', accentColor: '#f1e5dd', isFeatured: false, sortOrder: 0, metadata: {},
  facts: [{ key: 'license', label: 'License', value: 'Personal use' }], tags: [{ slug: 'cozy', name: 'Cozy' }], attachments: [] }

test('content validation rejects invalid publication, facts, roles and category metadata', () => {
  assert.equal(contentSchema.safeParse(item).success, true)
  assert.equal(contentSchema.safeParse({ ...item, uses: ['wallpaper', 'background', 'avatar'] }).success, true)
  assert.equal(contentSchema.safeParse({ ...item, uses: ['avatar', 'avatar'] }).success, false)
  assert.equal(contentSchema.safeParse({ ...item, status: 'published' }).success, false)
  assert.equal(contentSchema.safeParse({ ...item, facts: [...item.facts, ...item.facts] }).success, false)
  assert.equal(contentSchema.safeParse({ ...item, slug: '../escape' }).success, false)
  assert.equal(fileType('payload.svg'), null)
  assert.equal(fileType('game.ZIP')?.mediaType, 'file')
  assert.equal(fileType('track.flac')?.mediaType, 'audio')
  assert.throws(() => parseCategoryMetadata('images.v1', { width: 1920 }))
  assert.throws(() => parseCategoryMetadata('games.v1', { platforms: ['invalid'] }))
  assert.throws(() => parseCategoryMetadata('music.v1', { track_count: -1 }))
  assert.equal(contentSchema.safeParse({ ...item, attachments: [{ path: `${admin}/${member}.zip`, role: 'cover', altText: 'Cover' }] }).success, false)
})

test('content write is atomic, rechecks admin role and rejects category schema races', { timeout: 30000 }, async () => {
  const db = new PGlite()
  try {
    await db.exec('BEGIN')
    for (const file of ['0001_archive_items.sql', '0002_catalog_entities.sql', '0003_catalog_profiles_and_validation.sql', '0004_content_uses.sql', '0005_remove_legacy_catalog.sql', '0006_browse_uses.sql']) {
      await db.exec(await readFile(`db/migrations/${file}`, 'utf8'))
    }
    await db.exec('COMMIT')
    await db.query(`INSERT INTO catalog.profiles(id, role) VALUES ($1, 'admin'), ($2, 'member')`, [admin, member])
    const category = (await db.query<{ id: string; metadata_schema_key: string }>(`SELECT id::text, metadata_schema_key FROM catalog.categories ORDER BY id LIMIT 1`)).rows[0]
    const write = (actor: string, slug: string, schema = category.metadata_schema_key, attachments: unknown[] = []) => db.query(createContentQuery,
      [actor, category.id, schema, JSON.stringify({ ...item, slug, attachments }), 'private-uploads'])
    assert.equal((await write(member, 'forbidden')).rows.length, 0)
    assert.equal((await write(admin, 'wrong-schema', 'unknown.v1')).rows.length, 0)
    assert.equal((await write(admin, 'valid')).rows.length, 1)
    assert.equal((await db.query('SELECT * FROM catalog.item_facts')).rows.length, 1)
    assert.equal((await db.query('SELECT * FROM catalog.item_tags')).rows.length, 1)
    assert.deepEqual((await db.query<{ use_slug: string }>('SELECT use_slug FROM catalog.item_uses')).rows.map(row => row.use_slug), ['images'])
    const withUses = { ...item, slug: 'multi-use', uses: ['images', 'wallpaper', 'background', 'avatar'] }
    await db.query(createContentQuery, [admin, category.id, category.metadata_schema_key, JSON.stringify(withUses), 'private-uploads'])
    assert.equal((await db.query('SELECT * FROM catalog.item_uses')).rows.length, 5)
    await assert.rejects(db.query(createContentQuery, [admin, category.id, category.metadata_schema_key,
      JSON.stringify({ ...item, slug: 'unknown-use', uses: ['avatar', 'missing'] }), 'private-uploads']))
    assert.equal((await db.query("SELECT * FROM catalog.items WHERE slug = 'unknown-use'")).rows.length, 0)
    const asset = { path: `${admin}/${member}.png`, role: 'cover', altText: 'A scene',
      focalX: 50, focalY: 50, mediaType: 'image', mime: 'image/png', byteSize: 20 }
    assert.equal((await write(admin, 'with-cover', category.metadata_schema_key, [asset])).rows.length, 1)
    assert.equal((await db.query('SELECT * FROM catalog.item_assets')).rows.length, 1)
    assert.equal((await db.query('SELECT * FROM catalog.tags')).rows.length, 1)
    await assert.rejects(write(admin, 'rollback', category.metadata_schema_key, [{ path: 'broken', mediaType: 'invalid', mime: 'image/png', byteSize: 10 }]))
    assert.equal((await db.query(`SELECT * FROM catalog.items WHERE slug = 'rollback'`)).rows.length, 0)
    await db.query(`UPDATE catalog.profiles SET role = 'member' WHERE id = $1`, [admin])
    assert.equal((await write(admin, 'demoted')).rows.length, 0)
  } finally { await db.close() }
})
