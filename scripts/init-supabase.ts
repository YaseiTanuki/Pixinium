import { randomBytes } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { Client } from 'pg'
import { freshSupabaseSchema } from './prepare-supabase-schema'
import { supabaseTarget } from './supabase-target'

async function main() {
  const target = supabaseTarget()
  const client = new Client({ connectionString: target.connectionString, connectionTimeoutMillis: 10_000 })
  const apply = process.argv.includes('--apply')
  try {
    await client.connect()
    const { rows: [state] } = await client.query(`SELECT current_database() AS database, current_user AS role,
      to_regnamespace('catalog') IS NOT NULL AS has_catalog, to_regnamespace('automation') IS NOT NULL AS has_automation,
      to_regclass('public.schema_migrations') IS NOT NULL AS has_ledger, to_regclass('public.archive_items') IS NOT NULL AS has_legacy`)
    console.log(JSON.stringify({ project: process.env.SUPABASE_PROJECT_REF, mode: apply ? 'initialize' : 'read-only', ...state }))
    if (!apply) return
    if (state.has_catalog || state.has_automation || state.has_ledger || state.has_legacy) throw new Error('Target already has application data; review it before initialization.')
    const roles = ['pixinium_runtime', 'pixinium_catalog_admin', 'pixinium_agent_api']
    const collisions = await client.query('SELECT rolname FROM pg_roles WHERE rolname=ANY($1::text[])', [[...roles, 'pixinium_agent']])
    if (collisions.rows.length) throw new Error('Application role names already exist; review them before provisioning.')
    const credentials = roles.map(role => ({ role, password: randomBytes(32).toString('base64url') }))
    const keys = ['DATABASE_URL', 'CATALOG_ADMIN_DATABASE_URL', 'AGENT_DATABASE_URL']
    const runtime = credentials.map(({ role, password }, index) => `${keys[index]}=${target.runtimeUrl(role, password)}`)
    for (const key of ['R2_ENDPOINT_URL', 'R2_BUCKET_NAME', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_PRIVATE']) {
      runtime.push(`${key}=${process.env[key] ?? ''}`)
    }
    const filename = `.env.supabase-runtime.${Date.now()}.local`
    // Persist recovery credentials before starting DDL; no passwords go to stdout.
    await writeFile(filename, runtime.join('\n') + '\n', { mode: 0o600, flag: 'wx' })
    console.log(`Restricted runtime credentials saved to ${filename}`)
    await client.query((await freshSupabaseSchema()).replace(/COMMIT;\s*$/, ''))
    try {
      for (const { role, password } of credentials) {
        const { rows: [statement] } = await client.query("SELECT format('ALTER ROLE %I LOGIN PASSWORD %L', $1::text, $2::text) AS sql", [role, password])
        await client.query(statement.sql)
      }
      await client.query('COMMIT')
    } catch (error) { await client.query('ROLLBACK'); throw error }
    console.log('Fresh Supabase application schemas initialized; Auth users preserved. No source data was copied.')
  } finally { await client.end().catch(() => {}) }
}
main().catch(error => {
  console.error('Supabase initialization failed.', { code: typeof error?.code === 'string' ? error.code : 'configuration_or_setup' })
  process.exitCode = 1
})
