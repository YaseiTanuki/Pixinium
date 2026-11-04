import { neonConfig, Pool } from '@neondatabase/serverless'
import { readFile, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const agentMigrations = ['0019_independent_agents.sql', '0020_agent_draft_review.sql']
const name = process.argv[2] || agentMigrations.at(-1)
if (!agentMigrations.includes(name)) throw new Error('Choose a known agent migration target.')
const url = process.env.AGENT_MIGRATION_DATABASE_URL || process.env.DATABASE_URL_UNPOOLED
if (!url || new URL(url).hostname.includes('-pooler')) throw new Error('A direct migration connection is required.')
neonConfig.webSocketConstructor = WebSocket
const pool = new Pool({ connectionString: url })
try {
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    await db.query("SET LOCAL lock_timeout='10s'")
    await db.query('SELECT pg_advisory_xact_lock(724902846291::bigint)')
    const { rows: ledger } = await db.query('SELECT name,checksum FROM public.schema_migrations')
    const applied = new Map(ledger.map(row => [row.name, row.checksum]))
    const files = (await readdir('db/migrations')).filter(file => /^\d+_.+\.sql$/.test(file)).sort()
    const pending = []
    const migrations = new Map()
    for (const file of files) {
      const sql = await readFile(`db/migrations/${file}`, 'utf8')
      const checksum = createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex')
      if (applied.has(file) && applied.get(file) !== checksum) throw new Error(`Applied migration checksum differs: ${file}`)
      if (!applied.has(file)) pending.push(file)
      if (agentMigrations.includes(file)) migrations.set(file, { sql, checksum })
    }
    if (pending.some(file => !agentMigrations.includes(file) || file > name)) throw new Error('Unrelated or later migrations are pending. Review their scope separately.')
    const unknown = ledger.filter(row => !files.includes(row.name)).map(row => row.name)
    if (unknown.length) console.log('Retained existing ledger entries missing from this checkout:', unknown.join(', '))
    const { rows: [identity] } = await db.query("SELECT current_setting('neon.branch_id',true) AS branch_id,current_database() AS database")
    if (process.env.AGENT_EXPECTED_BRANCH_ID && identity.branch_id !== process.env.AGENT_EXPECTED_BRANCH_ID) throw new Error('Migration target branch does not match the expected branch.')
    for (const file of pending) {
      const migration = migrations.get(file)
      if (!migration) throw new Error('Migration source missing.')
      await db.query(migration.sql)
      await db.query('INSERT INTO public.schema_migrations(name,checksum) VALUES($1,$2)', [file, migration.checksum])
    }
    await db.query('COMMIT')
    console.log(`${pending.length ? 'Applied' : 'Already applied'}: ${name}; branch=${identity.branch_id || 'local'}; database=${identity.database}`)
  } catch (error) { await db.query('ROLLBACK'); throw error }
  finally { db.release() }
} catch (error) {
  console.error('Agent migration failed:', error.code || error.name)
  process.exitCode = 1
} finally { await pool.end() }
