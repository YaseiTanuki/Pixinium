import { neon } from '@neondatabase/serverless'

async function main() {
  const direct = process.env.DATABASE_URL_UNPOOLED
  if (!direct) throw new Error('Missing direct migration connection')
  const target = new URL(direct)
  if (target.hostname.includes('-pooler')) throw new Error('Migration connection must be direct')
  const sql = neon(direct)
  const state = await sql.query('SELECT current_database() AS database, current_user AS migration_role, to_regclass($1)::text AS ledger', ['public.schema_migrations'])
  console.log(JSON.stringify(state))
  if (state[0].ledger) console.log(JSON.stringify(await sql.query('SELECT name FROM public.schema_migrations ORDER BY name')))
  const ready = (await sql.query("SELECT to_regclass('catalog.item_uses') IS NOT NULL AS ready"))[0].ready
  for (const key of ['DATABASE_URL', 'CATALOG_ADMIN_DATABASE_URL']) {
    if (!process.env[key]) continue
    const url = new URL(process.env[key])
    const sameDatabase = url.pathname === target.pathname && url.hostname.replace('-pooler', '') === target.hostname.replace('-pooler', '')
    if (!sameDatabase) throw new Error(`${key} does not point at the migration database`)
    const db = neon(process.env[key])
    const roles = await db.query('SELECT current_user AS role, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user')
    console.log(JSON.stringify({connection: key, sameDatabase, roles}))
    if (ready) {
      const privileges = await db.query("SELECT has_table_privilege(current_user, 'catalog.content_uses', 'SELECT') AS read_uses, has_table_privilege(current_user, 'catalog.item_uses', 'SELECT') AS read_links, has_table_privilege(current_user, 'catalog.item_uses', 'INSERT') AS write_links")
      console.log(JSON.stringify({connection: key, privileges}))
      console.log(JSON.stringify({connection: key, uses: await db.query('SELECT slug, name FROM catalog.content_uses ORDER BY sort_order')}))
    }
  }
  if (ready) console.log(JSON.stringify(await sql.query(`SELECT
    to_regclass('public.archive_items') IS NULL AS old_archive_removed,
    to_regclass('catalog.legacy_item_keys') IS NULL AS legacy_keys_removed,
    NOT EXISTS (SELECT 1 FROM catalog.items WHERE metadata ? 'legacy') AS legacy_metadata_removed,
    EXISTS (SELECT 1 FROM catalog.categories WHERE slug = 'images' AND metadata_schema_key = 'images.v1') AS images_ready`)))
}

main().catch(() => { console.error('Migration inspection failed; no credentials or provider details logged.'); process.exitCode = 1 })
