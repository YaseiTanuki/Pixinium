import assert from 'node:assert/strict'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { migrate } from '../scripts/migrations.ts'
import { collectItemQuery, ensureSavedCollectionQuery, savedItemsQuery, uncollectItemQuery } from '../server/repositories/saved-items.ts'
import { cardsQuery } from '../server/repositories/catalog.queries.ts'

test('collect persists once per account, isolates owners, and supports uncollect', async () => {
  const db = new PGlite()
  const alice = '00000000-0000-4000-8000-000000000001'
  const bob = '00000000-0000-4000-8000-000000000002'
  try {
    await migrate({ query: (sql, values) => values ? db.query(sql, values) : db.exec(sql).then(rows => rows.at(-1)) })
    await db.query('INSERT INTO catalog.profiles (id) VALUES ($1), ($2)', [alice, bob])
    const { rows: [item] } = await db.query(`INSERT INTO catalog.items (category_id, slug, title, status, published_at)
      SELECT id, 'collect-test', 'Collect test', 'published', now() FROM catalog.categories LIMIT 1 RETURNING id::text`)
    await db.exec(`CREATE ROLE collect_runtime NOSUPERUSER NOBYPASSRLS;
      GRANT USAGE ON SCHEMA catalog TO collect_runtime;
      GRANT SELECT ON ALL TABLES IN SCHEMA catalog TO collect_runtime;
      GRANT INSERT, UPDATE, DELETE ON catalog.collections, catalog.collection_items TO collect_runtime;
      GRANT USAGE ON SEQUENCE catalog.collections_id_seq TO collect_runtime;
      SET ROLE collect_runtime;`)
    const identity = id => db.query("SELECT set_config('app.user_id', $1, false)", [id])
    const list = async id => (await db.query(savedItemsQuery, [id])).rows.map(row => row.id)
    await identity(alice)
    await db.query(ensureSavedCollectionQuery, [alice])
    await db.query(ensureSavedCollectionQuery, [alice])
    await db.query(collectItemQuery, [alice, item.id])
    const { rows: [first] } = await db.query('SELECT added_at FROM catalog.collection_items')
    await db.query(collectItemQuery, [alice, item.id])
    assert.deepEqual(await list(alice), [item.id])
    assert.deepEqual((await db.query('SELECT added_at FROM catalog.collection_items')).rows[0].added_at, first.added_at)
    await identity(bob)
    assert.deepEqual(await list(alice), [])
    await db.query(uncollectItemQuery, [alice, item.id])
    await db.query(ensureSavedCollectionQuery, [bob])
    await db.query(collectItemQuery, [bob, item.id])
    assert.deepEqual(await list(bob), [item.id])
    await db.exec('RESET ROLE')
    assert.equal((await db.query('SELECT count(*)::int AS total FROM catalog.collection_items WHERE item_id = $1', [item.id])).rows[0].total, 2)
    // Public cards expose only the aggregate, excluding custom/editorial collections.
    await db.query(`INSERT INTO catalog.collections(owner_user_id, kind, slug) VALUES ($1, 'custom', 'favorites')`, [alice])
    await db.query(`INSERT INTO catalog.collection_items(collection_id, item_id)
      SELECT id, $1 FROM catalog.collections WHERE kind = 'custom'`, [item.id])
    const publicCard = (await db.query(cardsQuery, [null, 'collect-test', null])).rows[0]
    assert.equal(publicCard.collect_count, 2)
    assert.ok(!JSON.stringify(publicCard).includes(alice))
    assert.ok(!JSON.stringify(publicCard).includes(bob))
    await db.query("UPDATE catalog.items SET status = 'archived' WHERE id = $1", [item.id])
    await db.exec('SET ROLE collect_runtime')
    await identity(alice)
    assert.deepEqual(await list(alice), [])
    await db.query(collectItemQuery, [alice, '9223372036854775807'])
    await identity('')
    assert.deepEqual(await list(alice), [])
    await assert.rejects(db.query(ensureSavedCollectionQuery, [alice]), /row-level security/)
    await db.exec('RESET ROLE')
    await db.query("UPDATE catalog.items SET status = 'published' WHERE id = $1", [item.id])
    await db.exec('SET ROLE collect_runtime')
    await identity(alice)
    assert.deepEqual(await list(alice), [item.id], 'another account cannot remove the saved item')
    await db.query(uncollectItemQuery, [alice, item.id])
    await db.query(uncollectItemQuery, [alice, item.id])
    assert.deepEqual(await list(alice), [])
    await identity(bob)
    assert.deepEqual(await list(bob), [item.id])
  } finally { await db.close() }
})
