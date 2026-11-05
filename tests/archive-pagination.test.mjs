import assert from 'node:assert/strict'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { migrate } from '../scripts/migrations.ts'
import { archiveCountQuery, archivePageQuery, archiveTagsQuery } from '../server/repositories/catalog.queries.ts'
import { sitemapItemsQuery } from '../server/repositories/catalog-seo.queries.ts'
import { CATALOG_DISPLAY, searchHref, categoryHref } from '../lib/catalog.ts'
import { searchTags, searchSort, searchCategories } from '../lib/search-filters.ts'

test('archive pages respect the configured size, preserve filters and exclude unpublished content', async () => {
  const db = new PGlite()
  try {
    await migrate({ query: (sql, values) => values ? db.query(sql, values) : db.exec(sql).then(rows => rows.at(-1)) })
    await db.exec(`INSERT INTO catalog.items(category_id, slug, title, status, published_at)
      SELECT c.id, 'image-' || n, 'Image ' || n, 'published', now()
      FROM catalog.categories c CROSS JOIN generate_series(1, 45) n WHERE c.slug = 'images';
      INSERT INTO catalog.item_tags(item_id, tag_id)
      SELECT i.id, t.id FROM catalog.items i CROSS JOIN catalog.tags t
      WHERE i.slug LIKE 'image-%' AND t.slug = 'wallpaper';
      INSERT INTO catalog.items(category_id, slug, title, status)
      SELECT id, 'hidden-image', 'Hidden image', 'archived' FROM catalog.categories WHERE slug = 'images';`)
    const params = [null, null, null, null]
    const count = async (filters, match = 'all') => (await db.query(archiveCountQuery, [...filters, match])).rows[0].total
    const page = async (offset, filters = params, match = 'all', sort = '') => (await db.query(archivePageQuery, [...filters, match, CATALOG_DISPLAY.archivePageSize, offset, sort])).rows
    assert.equal(await count(params), 45)
    assert.equal((await db.query(sitemapItemsQuery)).rows.length, 45)
    assert.deepEqual((await db.query(archiveTagsQuery)).rows.map(tag => tag.slug), ['wallpaper'])
    assert.equal(await count(['images', null, '%Image 1%', 'wallpaper']), 11)
    assert.equal(await count(['missing', null, null, 'wallpaper']), 0)
    assert.equal(await count([null, null, null, 'wallpaper missing']), 0)
    assert.equal(await count([null, null, null, 'wallpaper missing'], 'any'), 45)
    assert.equal(await count([null, null, null, 'Wallpaper']), 45)
    await db.exec(`INSERT INTO catalog.tags(slug, name) VALUES ('moon', 'Moon');
      INSERT INTO catalog.item_tags(item_id, tag_id)
      SELECT i.id, t.id FROM catalog.items i CROSS JOIN catalog.tags t
      WHERE i.slug = 'image-1' AND t.slug = 'moon';
      UPDATE catalog.items SET view_count = 100, download_count = 50, published_at = now() + interval '1 day' WHERE slug = 'image-2';`)
    assert.equal(await count([null, null, null, 'wallpaper moon']), 1)
    assert.equal(await count([null, null, null, 'wallpaper moon'], 'any'), 45)
    assert.equal((await page(0))[0].item.slug, 'image-2') // Default order is newest, without item sort_order.
    assert.equal((await page(0, params, 'all', 'views'))[0].item.slug, 'image-2')
    assert.equal((await page(0, params, 'all', 'downloads'))[0].item.slug, 'image-2')
    assert.equal((await page(0, params, 'all', 'newest'))[0].item.slug, 'image-2')
    assert.equal((await page(0, params, 'all', 'title'))[0].item.slug, 'image-1')
    assert.deepEqual(searchTags(' #Cat cat, MOON   wallpaper '), ['cat', 'moon', 'wallpaper'])
    const { rows: [original] } = await db.query(`INSERT INTO catalog.assets(provider,bucket,object_path,media_type,mime_type,width,height)
      VALUES ('s3','assets','fixture/original.png','image','image/png',3840,2160) RETURNING id::text`)
    const { rows: [thumbnail] } = await db.query(`INSERT INTO catalog.assets(provider,bucket,object_path,media_type,mime_type,width,height)
      VALUES ('s3','assets','fixture/thumbnail.webp','image','image/webp',800,450) RETURNING id::text`)
    await db.query(`INSERT INTO catalog.item_assets(item_id,asset_id,role)
      SELECT id,$1::bigint,'download' FROM catalog.items WHERE slug='image-1'`, [original.id])
    await db.query(`INSERT INTO catalog.item_assets(item_id,asset_id,role)
      SELECT id,$1::bigint,'cover' FROM catalog.items WHERE slug='image-1'`, [thumbnail.id])
    const sitemapImages = (await db.query(sitemapItemsQuery)).rows.find(item => item.slug === 'image-1').images
    assert.deepEqual(sitemapImages, [`/api/assets/${original.id}?view=1`])
    assert.ok(!sitemapImages.some(url => url.includes(`/assets/${thumbnail.id}`)))
    assert.equal(searchSort('not-a-sort'), '')
    assert.equal(searchHref({ tag: 'cat moon', sort: 'views', tagMatch: 'any', page: 2 }), '/search?tag=cat+moon&sort=views&match=any&page=2')
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
    // Categories are independent of tags, including future categories.
    await db.exec(`INSERT INTO catalog.categories(slug, name, metadata_schema_key)
      VALUES ('soundtracks', 'Soundtracks', 'music.v1');
      INSERT INTO catalog.items(category_id, slug, title, status, published_at)
      SELECT id, 'untagged-track', 'Untagged track', 'published', now()
      FROM catalog.categories WHERE slug = 'soundtracks';`)
    assert.equal(await count(['images', null, null, null]), 45)
    assert.equal(await count(['soundtracks', null, null, null]), 1)
    assert.equal(await count(['images,soundtracks', null, null, null]), 46)
    assert.equal(await count(['images,soundtracks', null, null, 'wallpaper']), 45)
    assert.equal((await page(36, ['images,soundtracks', null, null, null])).length, 10)
    assert.deepEqual(searchCategories('images, music,images,, '), ['images', 'music'])
    assert.equal(searchHref({ category: 'images,music', page: 2 }), '/search?category=images%2Cmusic&page=2')
    const tracks = await page(0, ['soundtracks', null, null, null])
    assert.equal(tracks[0].item.title, 'Untagged track')
    assert.equal(tracks[0].collect_count, 0)
    assert.equal(await count(['soundtracks', null, '%Image%', null]), 0)
    assert.equal(await count(['missing', null, null, null]), 0)
    await db.exec("UPDATE catalog.categories SET is_active = false WHERE slug = 'soundtracks'")
    assert.equal(await count(['soundtracks', null, null, null]), 0)
    assert.equal(await count(['images,soundtracks', null, null, null]), 45)
    await db.exec("UPDATE catalog.categories SET is_active = false WHERE slug = 'images'")
    assert.equal(await count(params), 0)
    assert.equal((await page(0)).length, 0)
    assert.deepEqual((await db.query(archiveTagsQuery)).rows, [])
    assert.deepEqual((await db.query(sitemapItemsQuery)).rows, [])
    assert.equal(searchHref({ category: 'images', tag: 'wallpaper', query: 'cat & moon', page: 2 }), '/search?tag=wallpaper&category=images&q=cat+%26+moon&page=2')
    assert.equal(searchHref({ tag: 'wallpaper', query: 'cat & moon', page: 2 }), '/search?tag=wallpaper&q=cat+%26+moon&page=2')
    assert.equal(searchHref({ page: 1 }), '/search')
    assert.equal(categoryHref('images', { query: 'cat & moon', tag: 'cat moon', sort: 'views', tagMatch: 'any', page: 2 }), '/images?q=cat+%26+moon&tag=cat+moon&sort=views&match=any&page=2')
    assert.equal(categoryHref('music', { tag: 'piano', page: 1 }), '/music?tag=piano')
  } finally { await db.close() }
})
