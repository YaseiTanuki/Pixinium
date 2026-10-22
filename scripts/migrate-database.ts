import { Pool, neonConfig } from '@neondatabase/serverless'
import { migrate } from './migrations'

async function main() {
  const connectionString = process.env.DATABASE_URL_UNPOOLED
  if (!connectionString) throw new Error('DATABASE_URL_UNPOOLED is required for migrations.')
  if (new URL(connectionString).hostname.includes('-pooler')) throw new Error('Use a direct, unpooled database URL for migrations.')
  neonConfig.webSocketConstructor = WebSocket
  const pool = new Pool({ connectionString })
  try {
    const connection = await pool.connect()
    try {
      const applied = await migrate(connection)
      console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database migrations are up to date.')
    } finally {
      connection.release()
    }
  } finally {
    await pool.end()
  }
}

main().catch((error: unknown) => {
  // Avoid printing connection details from driver errors.
  console.error('Migration failed:', error instanceof Error ? error.message : 'Unknown error')
  process.exitCode = 1
})
