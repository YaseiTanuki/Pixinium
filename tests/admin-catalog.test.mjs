import assert from 'node:assert/strict'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { migrate } from '../scripts/migrations.ts'
import { adminCatalogCountQuery, adminCatalogPageQuery } from '../server/repositories/admin-catalog.queries.ts'
import { ADMIN_CATALOG_PAGE_SIZE, EMPTY_ADMIN_FILTERS, parseAdminCatalogFilters, adminCatalogParams, adminCatalogHref } from '../lib/admin/catalog-filters.ts'

test('admin collection filters include old and archived content and preserve pagination', async () => {
  const db = new PGlite()
  try {
    await migrate({ query: (sql, values) => values ? db.query(sql, values) : db.exec(sql).then(rows => rows.at(-1)) })
    await db.exec(`INSERT INTO catalog.items(category_id, slug, title, status, created_at, published_at)
      SELECT c.id, 'admin-image-' || n, 'Image ' || n, CASE WHEN n = 1 THEN 'archived' ELSE 'published' END,
      now() - make_interval(days => n), now() FROM catalog.categories c CROSS JOIN generate_series(1, 25) n WHERE c.slug = 'images';
      INSERT INTO catalog.item_tags(item_id, tag_id) SELECT i.id, t.id FROM catalog.items i CROSS JOIN catalog.tags t
      WHERE i.slug LIKE 'admin-image-%' AND t.slug = 'wallpaper';
      INSERT INTO catalog.items(category_id, slug, title, status, published_at)
      SELECT id, 'admin-music', 'Music 100%_literal', 'published', now() FROM catalog.categories WHERE slug = 'music';
      UPDATE catalog.items SET description = 'A quiet piano arrangement', view_count = 99, download_count = 50 WHERE slug = 'admin-music';`)
    const count = async filters => (await db.query(adminCatalogCountQuery, adminCatalogParams({ ...EMPTY_ADMIN_FILTERS, status: 'all', ...filters }))).rows[0].total
    const page = async (offset, filters = {}) => {
      const applied = { ...EMPTY_ADMIN_FILTERS, status: 'all', ...filters }
      return (await db.query(adminCatalogPageQuery, [...adminCatalogParams(applied), ADMIN_CATALOG_PAGE_SIZE, offset, applied.sort])).rows
    }
    assert.equal(await count({}), 26)
    assert.equal(await count({ status: EMPTY_ADMIN_FILTERS.status }), 25)
    assert.equal(await count({ status: 'archived' }), 1)
    assert.equal(await count({ category: 'images,music', status: 'published' }), 25)
    assert.equal(await count({ category: 'music', tag: 'wallpaper' }), 0)
    assert.equal(await count({ tag: 'wallpaper missing', tagMatch: 'all' }), 0)
    assert.equal(await count({ tag: 'wallpaper missing', tagMatch: 'any' }), 25)
    assert.equal(await count({ query: '100%_' }), 1)
    assert.equal(await count({ query: 'quiet piano' }), 1)
    const first = await page(0)
    const second = await page(20)
    assert.equal(first.length, 20)
    assert.equal(second.length, 6)
    assert.equal(new Set([...first, ...second].map(row => row.id)).size, 26)
    assert.equal((await page(0, { sort: 'oldest' }))[0].slug, 'admin-image-25')
    assert.equal((await page(0, { sort: 'views' }))[0].slug, 'admin-music')
    assert.equal((await page(0, { sort: 'downloads' }))[0].slug, 'admin-music')
    assert.equal((await page(0, { status: 'archived' }))[0].slug, 'admin-image-1')
    const applied = parseAdminCatalogFilters({ q: ' Image ', category: ['images', 'music'], status: 'archived', tag: 'WallPaper missing', match: 'any', sort: 'oldest' })
    const url = new URL(adminCatalogHref(applied, 2), 'http://localhost')
    assert.equal(url.pathname, '/admin')
    assert.equal(url.searchParams.get('category'), 'images,music')
    assert.equal(url.searchParams.get('tag'), 'wallpaper missing')
    assert.equal(url.searchParams.get('page'), '2')
    assert.equal(url.hash, '#admin-collection')
    assert.deepEqual(parseAdminCatalogFilters({ status: 'invalid', sort: 'invalid' }), EMPTY_ADMIN_FILTERS)
  } finally { await db.close() }
})
