import assert from 'node:assert/strict'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { migrate } from '../scripts/migrations.ts'
import { archiveCountQuery, archivePageQuery } from '../server/repositories/catalog.queries.ts'
import { CATALOG_DISPLAY, searchHref } from '../lib/catalog.ts'

test('archive pages respect the configured size, preserve filters and exclude unpublished content', async () => {
  const db = new PGlite()
  try {
    await migrate({ query: (sql, values) => values ? db.query(sql, values) : db.exec(sql).then(rows => rows.at(-1)) })
    await db.exec(`INSERT INTO catalog.items(category_id, slug, title, status, published_at)
      SELECT c.id, 'image-' || n, 'Image ' || n, 'published', now()
      FROM catalog.categories c CROSS JOIN generate_series(1, 45) n WHERE c.slug = 'images';
      INSERT INTO catalog.item_uses(item_id, use_slug)
      SELECT id, 'wallpaper' FROM catalog.items WHERE slug LIKE 'image-%';
      INSERT INTO catalog.items(category_id, slug, title, status)
      SELECT id, 'hidden-image', 'Hidden image', 'archived' FROM catalog.categories WHERE slug = 'images';`)
    const params = [null, null, null, null]
    const count = async filters => (await db.query(archiveCountQuery, filters)).rows[0].total
    const page = async (offset, filters = params) => (await db.query(archivePageQuery, [...filters, CATALOG_DISPLAY.archivePageSize, offset])).rows
    assert.equal(await count(params), 45)
    const first = await page(0)
    const ids = []
    for (let offset = 0; offset < 45; offset += CATALOG_DISPLAY.archivePageSize) {
      const rows = await page(offset)
      assert.equal(rows.length, Math.min(CATALOG_DISPLAY.archivePageSize, 45 - offset))
      ids.push(...rows.map(row => row.item.id))
    }
    assert.equal(new Set(ids).size, 45)
    assert.deepEqual((await page(0)).map(row => row.item.id), first.map(row => row.item.id))
    assert.equal(await count([null, null, '%Image 1%', 'wallpaper']), 11)
    assert.equal((await page(0, [null, null, '%Image 1%', 'wallpaper'])).length, Math.min(11, CATALOG_DISPLAY.archivePageSize))
    assert.equal(await count([null, null, null, 'music']), 0)
    assert.equal((await page(0, [null, null, null, 'unknown'])).length, 0)
    // Categories are independent of content-use tags, including future categories.
    await db.exec(`INSERT INTO catalog.categories(slug, name, metadata_schema_key)
      VALUES ('soundtracks', 'Soundtracks', 'music.v1');
      INSERT INTO catalog.items(category_id, slug, title, status, published_at)
      SELECT id, 'untagged-track', 'Untagged track', 'published', now()
      FROM catalog.categories WHERE slug = 'soundtracks';`)
    assert.equal(await count(['images', null, null, null]), 45)
    assert.equal(await count(['soundtracks', null, null, null]), 1)
    const tracks = await page(0, ['soundtracks', null, null, null])
    assert.equal(tracks[0].item.title, 'Untagged track')
    assert.equal(tracks[0].collect_count, 0)
    assert.equal(await count(['soundtracks', null, '%Image%', null]), 0)
    assert.equal(await count(['missing', null, null, null]), 0)
    await db.exec("UPDATE catalog.categories SET is_active = false WHERE slug = 'soundtracks'")
    assert.equal(await count(['soundtracks', null, null, null]), 0)
    await db.exec("UPDATE catalog.categories SET is_active = false WHERE slug = 'images'")
    assert.equal(await count(params), 0)
    assert.equal((await page(0)).length, 0)
    assert.equal(searchHref({ use: 'wallpaper', query: 'cat & moon', page: 2 }), '/search?use=wallpaper&q=cat+%26+moon&page=2')
    assert.equal(searchHref({ page: 1 }), '/search')
  } finally { await db.close() }
})
