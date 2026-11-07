import { Pool, neonConfig } from '@neondatabase/serverless'
import { migrate } from './migrations'

async function main() {
  const connectionString = process.env.DATABASE_URL_UNPOOLED
  if (!connectionString) throw new Error('DATABASE_URL_UNPOOLED is required for migrations.')
  const hostname = new URL(connectionString).hostname
  if (hostname.includes('-pooler')) throw new Error('Use a direct, unpooled database URL for migrations.')
  const expectedHost = process.env.MIGRATION_TARGET_HOST
  if (process.env.NEON_BRANCH === 'production' && !expectedHost) throw new Error('Set MIGRATION_TARGET_HOST to the verified production endpoint before migrating.')
  if (expectedHost && hostname !== expectedHost) throw new Error('Migration endpoint does not match MIGRATION_TARGET_HOST.')
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
