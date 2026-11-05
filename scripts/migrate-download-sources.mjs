import { neonConfig, Pool } from '@neondatabase/serverless'
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'

const name = '0022_download_sources.sql'
const apply = process.argv.includes('--apply')
const dryRun = process.argv.includes('--dry-run')
const url = process.env.DATABASE_URL_UNPOOLED
if (!url || new URL(url).hostname.includes('-pooler')) throw new Error('A direct DATABASE_URL_UNPOOLED is required.')
if ((apply || dryRun) && process.env.NEON_BRANCH !== 'dev') throw new Error('This runner applies only to the configured dev environment.')
neonConfig.webSocketConstructor = WebSocket
const pool = new Pool({ connectionString: url })
try {
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    await db.query('SELECT pg_advisory_xact_lock(724902846291::bigint)')
    const { rows: ledger } = await db.query('SELECT name,checksum FROM public.schema_migrations')
    const files = (await readdir('db/migrations')).filter(file => /^\d+_.+\.sql$/.test(file)).sort()
    const pending = []
    let migration
    for (const file of files) {
      const sql = await readFile(`db/migrations/${file}`, 'utf8')
      const checksum = createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex')
      const previous = ledger.find(row => row.name === file)
      if (previous && previous.checksum !== checksum) throw new Error(`Applied migration checksum differs: ${file}`)
      if (!previous) pending.push(file)
      if (file === name) migration = { sql, checksum }
    }
    const { rows: [identity] } = await db.query("SELECT current_setting('neon.branch_id',true) AS branch_id,current_database() AS database")
    console.log(JSON.stringify({ environment: process.env.NEON_BRANCH, identity, pending,
      historical: ledger.filter(row => !files.includes(row.name)).map(row => row.name) }))
    if (!apply && !dryRun) { await db.query('ROLLBACK'); process.exitCode = 0 }
    else {
      if (pending.some(file => file !== name)) throw new Error('Unrelated migrations are pending.')
      if (process.env.DOWNLOAD_SOURCES_EXPECTED_BRANCH_ID !== identity.branch_id) throw new Error('Set DOWNLOAD_SOURCES_EXPECTED_BRANCH_ID to the verified branch ID.')
      if (pending.length) {
        if (!migration) throw new Error('Download-source migration is missing.')
        await db.query(migration.sql)
        await db.query('INSERT INTO public.schema_migrations(name,checksum) VALUES($1,$2)', [name, migration.checksum])
      }
      const { rows: sources } = await db.query('SELECT slug,name,priority,is_active FROM catalog.download_sources ORDER BY priority,slug')
      const { rows: [links] } = await db.query("SELECT (SELECT count(*)::int FROM catalog.item_download_sources) AS links,(SELECT count(*)::int FROM catalog.items WHERE metadata ? 'download_sources') AS metadata_entries_remaining")
      if (links.metadata_entries_remaining !== 0) throw new Error('Old source metadata remains.')
      await db.query(dryRun ? 'ROLLBACK' : 'COMMIT')
      console.log(JSON.stringify({ result: dryRun ? 'Dry run rolled back' : pending.length ? `Applied ${name}` : 'Already applied', sources, links }))
    }
  } catch (error) { await db.query('ROLLBACK'); throw error }
  finally { db.release() }
} catch (error) {
  console.error('Download-source migration failed:', error.message)
  process.exitCode = 1
} finally { await pool.end() }
