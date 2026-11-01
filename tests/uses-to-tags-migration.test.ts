import assert from 'node:assert/strict'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { readMigrations } from '../scripts/migrations'

async function beforeMigration(db: PGlite) {
  const migrations = await readMigrations()
  for (const migration of migrations.filter(m => m.name < '0016_')) await db.exec(migration.sql)
  await db.exec(`
    INSERT INTO catalog.items(category_id, slug, title, status, published_at)
    SELECT id, 'published', 'Published', 'published', now() FROM catalog.categories WHERE slug = 'images';
    INSERT INTO catalog.items(category_id, slug, title, status)
    SELECT id, 'archived', 'Archived', 'archived' FROM catalog.categories WHERE slug = 'images';
    INSERT INTO catalog.tags(slug, name) VALUES ('wallpaper', 'Existing wallpaper label'), ('cozy', 'Cozy');
    INSERT INTO catalog.item_tags(item_id, tag_id)
      SELECT i.id, t.id FROM catalog.items i CROSS JOIN catalog.tags t WHERE t.slug IN ('wallpaper', 'cozy');
    INSERT INTO catalog.content_uses(slug, name) VALUES ('custom-use', 'Custom use'), ('unused', 'Unused');
    INSERT INTO catalog.item_uses(item_id, use_slug)
      SELECT id, u FROM catalog.items CROSS JOIN unnest(ARRAY['images', 'wallpaper', 'avatar', 'custom-use']) u;
  `)
  return migrations.find(m => m.name === '0016_merge_uses_into_tags.sql')!.sql
}

test('uses migrate to deduplicated tags for published and archived items without changing existing tags', async () => {
  const db = new PGlite()
  try {
    const sql = await beforeMigration(db)
    const before = (await db.query<{ id: number; title: string; slug: string; status: string }>('SELECT id, title, slug, status FROM catalog.items ORDER BY id')).rows
    await db.exec(`BEGIN; ${sql} COMMIT;`)
    assert.deepEqual((await db.query('SELECT id, title, slug, status FROM catalog.items ORDER BY id')).rows, before)
    assert.deepEqual((await db.query("SELECT to_regclass('catalog.item_uses') AS links, to_regclass('catalog.content_uses') AS uses")).rows,
      [{ links: null, uses: null }])
    assert.equal((await db.query<{ name: string }>("SELECT name FROM catalog.tags WHERE slug = 'wallpaper'")).rows[0].name, 'Existing wallpaper label')
    assert.equal((await db.query<{ name: string }>("SELECT name FROM catalog.tags WHERE slug = 'unused'")).rows[0].name, 'Unused')
    for (const item of before) {
      const tags = (await db.query<{ slug: string }>(`SELECT t.slug FROM catalog.item_tags it
        JOIN catalog.tags t ON t.id = it.tag_id WHERE it.item_id = $1 ORDER BY t.slug`, [item.id])).rows
      assert.deepEqual(tags.map(t => t.slug), ['avatar', 'cozy', 'custom-use', 'images', 'wallpaper'])
    }
  } finally { await db.close() }
})

test('an unexpected dependency aborts removal and rolls back the entire tag backfill', async () => {
  const db = new PGlite()
  try {
    const sql = await beforeMigration(db)
    await db.exec('CREATE VIEW catalog.use_dependency AS SELECT * FROM catalog.content_uses')
    await db.exec('BEGIN')
    await assert.rejects(db.exec(sql), /depend/)
    await db.exec('ROLLBACK')
    assert.equal((await db.query('SELECT * FROM catalog.item_uses')).rows.length, 8)
    assert.equal((await db.query('SELECT * FROM catalog.item_tags')).rows.length, 4)
    assert.equal((await db.query("SELECT * FROM catalog.tags WHERE slug = 'custom-use'")).rows.length, 0)
  } finally { await db.close() }
})
