import assert from 'node:assert/strict'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { migrate } from '../scripts/migrations'
import { createContentQuery } from '../server/repositories/content-write'
import { cardsQuery } from '../server/repositories/catalog.queries'
import { deleteContentQuery } from '../server/repositories/content-delete'

test('asset-pack migration supports atomic cover/preview/ZIP persistence, visibility and deletion', async () => {
  const db = new PGlite()
  try {
    await migrate({ query: async (sql, values) => values ? db.query(sql, values) : (await db.exec(sql)).at(-1) })
    const owner = '00000000-0000-4000-8000-000000000001'
    await db.query("INSERT INTO catalog.profiles(id,role) VALUES ($1,'admin')", [owner])
    const { rows: [category] } = await db.query<{ id: string; metadata_schema_key: string }>(
      "SELECT id::text,metadata_schema_key FROM catalog.categories WHERE slug='assets'")
    assert.equal(category.metadata_schema_key, 'assets.v1')
    const image = { mediaType: 'image', mime: 'image/webp', byteSize: 100, width: 100, height: 80,
      altText: 'Pack artwork', focalX: 50, focalY: 50 }
    const doc = { slug: 'test-pack', title: 'Test pack', summary: '', description: '', status: 'published',
      accentColor: '#ffffff', isFeatured: false, sortOrder: 0, metadata: { image_count: 7 }, tags: [], facts: [], uses: [],
      attachments: [
        { ...image, role: 'cover', path: 'assets/1/thumbnail.webp' },
        ...Array.from({ length: 5 }, (_, index) => ({ ...image, role: 'preview', path: `assets/1/previews/${index + 1}.webp` })),
        { ...image, width: undefined, height: undefined, role: 'download', mediaType: 'file', mime: 'application/zip', path: 'assets/1/pack.zip' },
      ] }
    const { rows: [created] } = await db.query<{ id: string }>(createContentQuery,
      [owner, category.id, category.metadata_schema_key, JSON.stringify(doc), 'private-uploads'])
    const { rows: [loaded] } = await db.query<{ assets: Array<{ role: string; mediaType: string }>; uses: Array<{ slug: string }> }>(cardsQuery, ['assets', doc.slug, null])
    assert.equal(loaded.assets.filter(asset => asset.role === 'preview').length, 5)
    assert.deepEqual(loaded.assets.filter(asset => asset.role === 'download').map(asset => asset.mediaType), ['file'])
    assert.deepEqual(loaded.uses.map(use => use.slug), ['assets'])
    await db.query("UPDATE catalog.items SET status='archived' WHERE id=$1", [created.id])
    assert.equal((await db.query(cardsQuery, ['assets', doc.slug, null])).rows.length, 0)
    const { rows: [deleted] } = await db.query<{ assets: unknown[] }>(deleteContentQuery, [owner, created.id])
    assert.equal(deleted.assets.length, 7)
    assert.equal((await db.query('SELECT * FROM catalog.assets')).rows.length, 0)
    await assert.rejects(db.query(createContentQuery, [owner, category.id, category.metadata_schema_key,
      JSON.stringify({ ...doc, attachments: [{ ...image, role: 'gallery', path: 'invalid.webp' }] }), 'private-uploads']))
    assert.equal((await db.query('SELECT * FROM catalog.items')).rows.length, 0)
  } finally { await db.close() }
})
