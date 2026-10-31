import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { contentUpdateSchema } from '../lib/admin/content'
import { createContentQuery } from '../server/repositories/content-write'
import { currentAssetIdsQuery, editableContentQuery, updateContentQuery, updateContentStatements } from '../server/repositories/content-edit'

const admin = '00000000-0000-4000-8000-000000000001'
const member = '00000000-0000-4000-8000-000000000002'
const base = { title: 'Original', summary: 'Short', description: 'Long text', uses: ['wallpaper'], tags: [{ slug: 'cozy', name: 'Cozy' }, { slug: 'night', name: 'Night' }],
  facts: [{ key: 'license', label: 'License', value: 'Personal' }, { key: 'size', label: 'Size', value: 'Large' }] }

test('content update validation accepts text edits only', () => {
  assert.equal(contentUpdateSchema.safeParse({ id: '12', ...base }).success, true)
  assert.equal(contentUpdateSchema.safeParse({ id: '0', ...base }).success, false)
  assert.equal(contentUpdateSchema.safeParse({ id: '12', ...base, title: ' ' }).success, false)
  assert.equal(contentUpdateSchema.safeParse({ id: '12', ...base, tags: [...base.tags, base.tags[0]] }).success, false)
  assert.equal(contentUpdateSchema.safeParse({ id: '12', ...base, uses: ['a', 'a'] }).success, false)
  const parsed = contentUpdateSchema.parse({ id: '12', ...base, slug: 'changed', categoryId: '3' })
  assert.equal(Object.hasOwn(parsed, 'slug'), false)
  assert.equal(Object.hasOwn(parsed, 'categoryId'), false)
  assert.equal(parsed.attachments, undefined)
  const png = { path: `${admin}/${member}.png`, altText: 'Scene' }
  assert.equal(contentUpdateSchema.safeParse({ id: '12', ...base, attachments: [png] }).success, true)
  assert.equal(contentUpdateSchema.safeParse({ id: '12', ...base, attachments: [] }).success, false)
  assert.equal(contentUpdateSchema.safeParse({ id: '12', ...base, attachments: [png, png] }).success, false)
  assert.equal(contentUpdateSchema.safeParse({ id: '12', ...base, attachments: [{ ...png, altText: '' }] }).success, false)
})

test('content update diffs relations atomically and rechecks the admin role', { timeout: 30000 }, async () => {
  const db = new PGlite()
  try {
    await db.exec('BEGIN')
    for (const file of ['0001_archive_items.sql', '0002_catalog_entities.sql', '0003_catalog_profiles_and_validation.sql', '0004_content_uses.sql', '0005_remove_legacy_catalog.sql', '0006_browse_uses.sql', '0007_s3_assets.sql', '0008_original_and_thumbnail.sql', '0009_publish_only.sql']) {
      await db.exec(await readFile(`db/migrations/${file}`, 'utf8'))
    }
    await db.exec('COMMIT')
    await db.query(`INSERT INTO catalog.profiles(id, role) VALUES ($1, 'admin'), ($2, 'member')`, [admin, member])
    const category = (await db.query<{ id: string; metadata_schema_key: string; slug: string }>(`SELECT id::text, metadata_schema_key, slug FROM catalog.categories ORDER BY id LIMIT 1`)).rows[0]
    const create = async (slug: string) => (await db.query<{ id: string }>(createContentQuery, [admin, category.id, category.metadata_schema_key,
      JSON.stringify({ ...base, slug, status: 'published', accentColor: '#f1e5dd', isFeatured: false, sortOrder: 0, metadata: {}, attachments: [] }), 'private-uploads'])).rows[0]
    const target = await create('target')
    const other = await create('other')
    const edit = { title: 'Renamed', summary: 'New short', description: 'New long', uses: ['background'],
      tags: [{ slug: 'night', name: 'Night' }, { slug: 'dawn', name: 'Dawn' }], facts: [{ key: 'size', label: 'Dimensions', value: 'Huge' }, { key: 'format', label: 'Format', value: 'PNG' }] }
    const update = (actor: string, id: string, doc: unknown = edit, facts = true) => db.query<{ id: string; slug: string; category: string }>(updateContentQuery, [actor, id, JSON.stringify(doc), facts, null])

    assert.equal((await update(member, target.id)).rows.length, 0)
    assert.equal((await update(admin, '999999')).rows.length, 0)
    assert.equal((await db.query<{ title: string }>(editableContentQuery, [target.id])).rows[0].title, 'Original')

    const saved = (await update(admin, target.id)).rows[0]
    assert.deepEqual([saved.id, saved.slug, saved.category], [target.id, 'target', category.slug])
    const row = (await db.query<{ title: string; summary: string; description: string; slug: string; uses: string[]; tags: string[]; facts: Array<{ key: string; label: string; value: string }> }>(editableContentQuery, [target.id])).rows[0]
    assert.deepEqual([row.title, row.summary, row.description, row.slug], ['Renamed', 'New short', 'New long', 'target'])
    assert.deepEqual(row.uses, [category.slug, 'background'].sort())
    assert.deepEqual(row.tags, ['Dawn', 'Night'])
    assert.deepEqual(row.facts, edit.facts)
    const untouched = (await db.query<{ title: string; tags: string[]; facts: unknown[] }>(editableContentQuery, [other.id])).rows[0]
    assert.deepEqual([untouched.title, untouched.tags, untouched.facts.length], ['Original', ['Cozy', 'Night'], 2])

    await update(admin, target.id, { ...edit, description: edit.summary, tags: [], facts: [] }, false)
    const kept = (await db.query<{ description: string; tags: string[]; facts: unknown[] }>(editableContentQuery, [target.id])).rows[0]
    assert.deepEqual([kept.description, kept.tags, kept.facts.length], ['', [], 2])

    await assert.rejects(update(admin, target.id, { ...edit, title: 'Rolled back', uses: ['missing'] }))
    assert.equal((await db.query<{ title: string }>(editableContentQuery, [target.id])).rows[0].title, 'Renamed')

    // Replacing files swaps the cover link, removes only this item's orphaned assets and keeps shared ones.
    const file = (path: string, role: string, extra: Record<string, unknown> = {}) => ({ path, role, altText: 'Scene', focalX: 50, focalY: 50,
      mediaType: 'image', mime: role === 'cover' ? 'image/webp' : 'image/png', byteSize: 10, ...extra })
    const old = [file('image/1/originals/a.png', 'download'), file('image/1/thumbnail.webp', 'cover')]
    const shared = file('image/shared/originals/s.png', 'download')
    const withFiles = async (slug: string, attachments: unknown[]) => (await db.query<{ id: string }>(createContentQuery, [admin, category.id, category.metadata_schema_key,
      JSON.stringify({ ...base, slug, status: 'published', accentColor: '#f1e5dd', isFeatured: false, sortOrder: 0, metadata: {}, attachments }), 'private-uploads'])).rows[0]
    const replaceable = await withFiles('replaceable', [...old, shared])
    const sibling = await withFiles('sibling', [])
    await db.query(`INSERT INTO catalog.item_assets(item_id, asset_id, role, alt_text)
      SELECT $1::bigint, a.id, 'download', 'Scene' FROM catalog.assets a WHERE a.object_path = $2`, [sibling.id, shared.path])
    const ids = (await db.query<{ ids: string[] }>(currentAssetIdsQuery, [replaceable.id])).rows[0].ids
    assert.equal(ids.length, 3)
    const fresh = [file('image/1/v-1/originals/b.png', 'download', { width: 100 }), file('image/1/v-1/thumbnail.webp', 'cover')]
    const run = (actor: string) => db.transaction(async tx => {
      const results = []
      for (const [text, values] of updateContentStatements({ actor, id: replaceable.id, text: edit, editFacts: false,
        files: { oldAssetIds: ids, attachments: fresh, bucket: 'private-uploads', metadata: { image_count: 1 } } })) results.push((await tx.query<Record<string, unknown>>(text, values)).rows)
      return results
    })
    const denied = await run(member)
    assert.equal(denied[denied.length - 1].length, 0)
    assert.equal((await db.query(`SELECT 1 FROM catalog.assets WHERE object_path LIKE 'image/1/%'`)).rows.length, 2)
    const results = await run(admin)
    assert.deepEqual((results[1] as Array<{ object_path: string }>).map(r => r.object_path).sort(), old.map(a => a.path).sort())
    const links = (await db.query<{ role: string; object_path: string }>(`SELECT ia.role, a.object_path FROM catalog.item_assets ia
      JOIN catalog.assets a ON a.id = ia.asset_id WHERE ia.item_id = $1 ORDER BY ia.sort_order`, [replaceable.id])).rows
    assert.deepEqual(links.map(l => [l.role, l.object_path]), fresh.map(f => [f.role, f.path]))
    assert.equal((await db.query(`SELECT 1 FROM catalog.assets WHERE object_path LIKE 'image/1/originals/%' OR object_path = 'image/1/thumbnail.webp'`)).rows.length, 0)
    assert.equal((await db.query(`SELECT 1 FROM catalog.item_assets WHERE item_id = $1`, [sibling.id])).rows.length, 1)
    assert.deepEqual((await db.query<{ metadata: unknown }>(`SELECT metadata FROM catalog.items WHERE id = $1`, [replaceable.id])).rows[0].metadata, { image_count: 1 })
  } finally { await db.close() }
})
