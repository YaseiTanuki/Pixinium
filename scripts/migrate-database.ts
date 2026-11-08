import { Client } from 'pg'
import { migrate } from './migrations'
import { supabaseTarget } from './supabase-target'
import { databaseTlsConfig } from '../lib/database-tls'

async function main() {
  const { connectionString } = supabaseTarget()
  const connection = new Client({ ...databaseTlsConfig(connectionString), connectionTimeoutMillis: 10_000 })
  try {
    await connection.connect()
    const applied = await migrate(connection)
    console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database migrations are up to date.')
  } finally {
    await connection.end()
  }
}

main().catch((error: unknown) => {
  // Avoid printing connection details from driver errors.
  console.error('Migration failed:', error instanceof Error ? error.message : 'Unknown error')
  process.exitCode = 1
})
