import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export interface MigrationConnection {
  query(text: string, values?: unknown[]): Promise<unknown>
}

export async function readMigrations(directory = resolve(process.cwd(), 'db/migrations')) {
  const names = (await readdir(directory)).filter((name) => /^\d+_.+\.sql$/.test(name)).sort()
  return Promise.all(names.map(async (name) => {
    const sql = await readFile(resolve(directory, name), 'utf8')
    return { name, sql, checksum: createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex') }
  }))
}

/** One connection and transaction: DDL, backfill, and ledger either all commit or all roll back. */
export async function migrate(connection: MigrationConnection, directory?: string) {
  const migrations = await readMigrations(directory)
  await connection.query('BEGIN')
  try {
    await connection.query("SELECT pg_advisory_xact_lock(724902846291::bigint)")
    await connection.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
      name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`)
    await connection.query('REVOKE ALL ON public.schema_migrations FROM PUBLIC')
    const result = await connection.query('SELECT name, checksum FROM public.schema_migrations') as {
      rows: Array<{ name: string; checksum: string }>
    }
    const applied = new Map(result.rows.map((row) => [row.name, row.checksum]))
    const pending: string[] = []
    for (const migration of migrations) {
      const previous = applied.get(migration.name)
      if (previous && previous !== migration.checksum) {
        throw new Error(`Applied migration was modified: ${migration.name}`)
      }
      if (previous) continue
      await connection.query(migration.sql)
      await connection.query('INSERT INTO public.schema_migrations (name, checksum) VALUES ($1, $2)', [migration.name, migration.checksum])
      pending.push(migration.name)
    }
    await connection.query('COMMIT')
    return pending
  } catch (error) {
    await connection.query('ROLLBACK')
    throw error
  }
}
