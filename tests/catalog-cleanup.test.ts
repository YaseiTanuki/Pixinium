import assert from 'node:assert/strict'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { readMigrations } from '../scripts/migrations'
import { cardsQuery } from '../server/repositories/catalog.queries'

test('cleanup preserves files, creator, Saved ownership and useful game facts', async () => {
  const db = new PGlite()
  try {
    const migrations = await readMigrations()
    for (const migration of migrations.filter(m => m.name < '0012')) await db.exec(`BEGIN;\n${migration.sql}\nCOMMIT;`)
    await db.exec(`
      INSERT INTO catalog.profiles(id,username) VALUES ('00000000-0000-4000-8000-000000000001','alice');
      INSERT INTO catalog.collections(owner_user_id,kind,slug,title) VALUES ('00000000-0000-4000-8000-000000000001','saved','saved','Saved');
      INSERT INTO catalog.items(category_id,slug,title,summary,description,metadata)
        SELECT id,'image','Image','Same','Same','{}' FROM catalog.categories WHERE slug='images';
      INSERT INTO catalog.item_facts(item_id,key,label,value)
        SELECT i.id,v.key,v.key,v.value FROM catalog.items i CROSS JOIN (VALUES ('creator','Alice'),('resolution','100 x 100'),('format','PNG')) v(key,value);
      INSERT INTO catalog.collection_items(collection_id,item_id) SELECT c.id,i.id FROM catalog.collections c CROSS JOIN catalog.items i;
      INSERT INTO catalog.assets(provider,bucket,object_path,byte_size,width,height,mime_type)
        VALUES ('s3','assets','image.png',1024,100,100,'image/png');
      INSERT INTO catalog.item_assets(item_id,asset_id,role) SELECT i.id,a.id,'download' FROM catalog.items i CROSS JOIN catalog.assets a;
      INSERT INTO catalog.items(category_id,slug,title,metadata)
        SELECT id,'game','Game','{"platforms":["windows","linux"],"version":"1.2","size_bytes":1024}' FROM catalog.categories WHERE slug='games';
    `)
    await db.exec(`BEGIN;\n${migrations.find(m => m.name.startsWith('0012'))!.sql}\nCOMMIT;`)
    const removed = await db.query(`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='catalog' AND
      ((table_name='categories' AND column_name='accent_color') OR (table_name='collections' AND column_name IN ('title','description'))
      OR (table_name='collection_items' AND column_name='sort_order') OR (table_name='profiles' AND column_name='avatar_url'))`)
    assert.equal(removed.rows.length, 0)
    assert.equal((await db.query('SELECT * FROM catalog.collection_items')).rows.length, 1)
    const image = (await db.query<{ description: string; facts: { key: string }[]; assets: { byteSize: string }[] }>(cardsQuery, ['images', 'image', null])).rows[0]
    assert.equal(image.description, '')
    assert.deepEqual(image.facts.map(f => f.key), ['creator'])
    assert.equal(image.assets[0].byteSize, '1024')
    const game = (await db.query<{ facts: { value: string }[] }>(cardsQuery, ['games', 'game', null])).rows[0]
    assert.deepEqual(game.facts.map(f => f.value), ['windows, linux', '1.2'])
    assert.deepEqual((await db.query<{ metadata: unknown }>("SELECT metadata FROM catalog.items WHERE slug='game'")).rows[0].metadata, {})
  } finally { await db.close() }
})
