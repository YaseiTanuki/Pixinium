import { neonConfig, Pool } from '@neondatabase/serverless'
import { createHash } from 'node:crypto'
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises'

const name = '0023_remove_item_editorial_fields.sql'
const apply = process.argv.includes('--apply')
const dryRun = process.argv.includes('--dry-run')
const url = process.env.DATABASE_URL_UNPOOLED
if (!url || new URL(url).hostname.includes('-pooler')) throw new Error('Use direct DATABASE_URL_UNPOOLED.')
if ((apply || dryRun) && process.env.NEON_BRANCH !== 'dev') throw new Error('This runner targets the configured dev environment only.')
neonConfig.webSocketConstructor = WebSocket
const pool = new Pool({ connectionString: url })
try {
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    await db.query("SET LOCAL lock_timeout='10s'")
    await db.query('SELECT pg_advisory_xact_lock(724902846291::bigint)')
    const { rows: ledger } = await db.query('SELECT name,checksum FROM public.schema_migrations')
    const files = (await readdir('db/migrations')).filter(file => /^\d+_.+\.sql$/.test(file)).sort()
    const pending = []
    let migration
    for (const file of files) {
      const sql = await readFile(`db/migrations/${file}`, 'utf8')
      const checksum = createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex')
      const previous = ledger.find(row => row.name === file)
      if (previous && previous.checksum !== checksum) throw new Error(`Applied checksum changed: ${file}`)
      if (!previous) pending.push(file)
      if (file === name) migration = { sql, checksum }
    }
    const { rows: [identity] } = await db.query("SELECT current_setting('neon.branch_id',true) AS branch_id,current_database() AS database")
    console.log(JSON.stringify({ environment: process.env.NEON_BRANCH, identity, pending,
      historical: ledger.filter(row => !files.includes(row.name)).map(row => row.name) }))
    if (!apply && !dryRun) await db.query('ROLLBACK')
    else {
      if (pending.some(file => file !== name)) throw new Error('Unrelated migrations are pending.')
      if (process.env.ITEM_FIELDS_EXPECTED_BRANCH_ID !== identity.branch_id) throw new Error('Expected branch ID must match the verified target.')
      let backup
      if (pending.length) {
        if (!migration) throw new Error('Migration is missing.')
        await db.query('LOCK TABLE catalog.items IN SHARE ROW EXCLUSIVE MODE')
        const { rows: values } = await db.query('SELECT id::text,is_featured,sort_order FROM catalog.items ORDER BY id')
        if (apply) {
          const directory = `.tmp/item-editorial-fields-${new Date().toISOString().replace(/[:.]/g, '-')}`
          await mkdir(directory, { recursive: true })
          backup = `${directory}/removed-values.json`
          await writeFile(backup, JSON.stringify({ migration: name, identity, values }, null, 2), { flag: 'wx', mode: 0o600 })
        }
        await db.query(migration.sql)
        const { rows: [count] } = await db.query('SELECT count(*)::int AS total FROM catalog.items')
        if (count.total !== values.length) throw new Error('Item count changed unexpectedly.')
        await db.query('INSERT INTO public.schema_migrations(name,checksum) VALUES($1,$2)', [name, migration.checksum])
      }
      const { rows: remaining } = await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema='catalog' AND table_name='items' AND column_name IN ('is_featured','sort_order')")
      if (remaining.length) throw new Error('Retired item fields remain.')
      const { rows: [summary] } = await db.query("SELECT count(*)::int AS items,(SELECT count(*)::int FROM pg_indexes WHERE schemaname='catalog' AND indexname IN ('items_published_order_idx','items_category_published_idx')) AS indexes FROM catalog.items")
      await db.query(dryRun ? 'ROLLBACK' : 'COMMIT')
      console.log(JSON.stringify({ result: dryRun ? 'Dry run rolled back' : pending.length ? 'Migration applied' : 'Already applied', summary, backup }))
    }
  } catch (error) { await db.query('ROLLBACK'); throw error }
  finally { db.release() }
} catch (error) {
  console.error('Item field migration failed:', error.message)
  process.exitCode = 1
} finally { await pool.end() }
