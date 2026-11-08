import assert from 'node:assert/strict'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { freshSupabaseSchema } from '../scripts/prepare-supabase-schema'

test('fresh Supabase setup preserves Auth, seeds only references and restricts runtime roles', async t => {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec("CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); INSERT INTO auth.users VALUES ('00000000-0000-4000-8000-000000000001')")
  await db.exec(await freshSupabaseSchema())
  const count = async (table: string) => (await db.query<{ count: number }>(`SELECT count(*)::int AS count FROM ${table}`)).rows[0].count
  assert.equal(await count('auth.users'), 1)
  assert.equal(await count('catalog.categories'), 4)
  assert.equal(await count('catalog.download_sources'), 3)
  for (const table of ['catalog.items', 'catalog.profiles', 'automation.agents', 'automation.jobs', 'automation.api_keys']) assert.equal(await count(table), 0)
  await db.exec('SET ROLE pixinium_runtime')
  await assert.rejects(db.exec("INSERT INTO catalog.profiles(id,role) VALUES ('00000000-0000-4000-8000-000000000001','admin')"))
  await db.exec('RESET ROLE; SET ROLE pixinium_agent_api')
  await assert.rejects(db.query('SELECT * FROM automation.api_keys'))
  await assert.rejects(db.query('SELECT * FROM catalog.profiles'))
  await db.exec('RESET ROLE')
  await assert.rejects(db.exec(await freshSupabaseSchema()), /Target is not empty/)
  await db.exec('ROLLBACK')
  assert.equal(await count('auth.users'), 1)
})
