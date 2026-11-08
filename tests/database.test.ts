import assert from 'node:assert/strict'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { createDatabase } from '../lib/database'

test('Postgres adapter keeps statements lazy, parameterized and executes repeated awaits once', async t => {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec('CREATE TABLE example(value text)')
  let calls = 0
  let closes = 0
  const sql = createDatabase('fixture', () => ({ connect: async () => {}, end: async () => { closes++ },
    query: async (text, values) => { calls++; return db.query(text, values) } }))
  const value = "'); DROP TABLE example; --"
  const insert = sql`INSERT INTO example VALUES (${value}) RETURNING value`
  assert.equal(calls, 0)
  assert.equal((await insert)[0].value, value)
  assert.equal((await insert)[0].value, value)
  assert.equal(calls, 1)
  assert.equal(closes, 1)
  assert.equal((await db.query<{ count: number }>('SELECT count(*)::int AS count FROM example')).rows[0].count, 1)
})

test('transaction-local identity and writes share one connection; failures roll back and close it', async t => {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec('CREATE TABLE example(value text)')
  let connections = 0
  let closes = 0
  const sql = createDatabase('fixture', () => ({ connect: async () => { connections++ }, end: async () => { closes++ },
    query: (text, values) => db.query(text, values) }))
  const actor = '00000000-0000-4000-8000-000000000001'
  const results = await sql.transaction([
    sql`SELECT set_config('app.user_id', ${actor}, true)`,
    sql`INSERT INTO example VALUES (current_setting('app.user_id')) RETURNING value`,
  ])
  assert.equal(results[1][0].value, actor)
  assert.equal(connections, 1)
  assert.equal(closes, 1)
  await assert.rejects(sql.transaction(tx => [tx`INSERT INTO example VALUES ('rollback')`, tx`SELECT missing_column FROM example`]))
  assert.equal((await db.query<{ count: number }>('SELECT count(*)::int AS count FROM example')).rows[0].count, 1)
  assert.equal(connections, 2)
  assert.equal(closes, 2)
  const [identity] = await sql.transaction([sql`SELECT current_setting('app.user_id', true) AS actor`], { readOnly: true })
  assert.ok(!identity[0].actor)
  const other = createDatabase('other', () => { throw new Error('Must not connect') })
  await assert.rejects(sql.transaction([other`SELECT 1`]), /same database/)
})
