import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const first = '00000000-0000-4000-8000-000000000001'
const second = '00000000-0000-4000-8000-000000000002'

test('database enforces username length, uniqueness and one-time assignment', async () => {
  const db = new PGlite()
  try {
    for (const file of ['0001_archive_items.sql', '0002_catalog_entities.sql', '0003_catalog_profiles_and_validation.sql', '0010_permanent_usernames.sql']) {
      await db.exec(await readFile(`db/migrations/${file}`, 'utf8'))
    }
    await db.query('INSERT INTO catalog.profiles(id) VALUES ($1), ($2)', [first, second])
    await assert.rejects(db.query('UPDATE catalog.profiles SET username=$1 WHERE id=$2', ['a'.repeat(13), first]), { code: '23514' })
    await db.query('UPDATE catalog.profiles SET username=$1 WHERE id=$2', ['a'.repeat(12), first])
    await assert.rejects(db.query('UPDATE catalog.profiles SET username=$1 WHERE id=$2', ['a'.repeat(12), second]), { code: '23505' })
    await assert.rejects(db.query('UPDATE catalog.profiles SET username=$1 WHERE id=$2', ['newname', first]), { code: '23514' })
    await assert.rejects(db.query('UPDATE catalog.profiles SET username=NULL WHERE id=$1', [first]), { code: '23514' })
    await db.query('UPDATE catalog.profiles SET display_name=$1 WHERE id=$2', ['New display', first])
    assert.equal((await db.query<{ username: string }>('SELECT username FROM catalog.profiles WHERE id=$1', [first])).rows[0].username, 'a'.repeat(12))
  } finally { await db.close() }
})
