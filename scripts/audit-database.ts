import { neon } from '@neondatabase/serverless'

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.')
  const sql = neon(process.env.DATABASE_URL)
  const [role, tables, constraints, indexes, policies, migrations] = await sql.transaction([
    sql.query('SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user'),
    sql.query("SELECT schemaname, tablename, tableowner, rowsecurity FROM pg_tables WHERE schemaname IN ('public', 'catalog') ORDER BY 1, 2"),
    sql.query(`SELECT n.nspname AS schema, c.relname AS table_name, con.conname, pg_get_constraintdef(con.oid) AS definition
      FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname IN ('public', 'catalog') ORDER BY 1, 2, 3`),
    sql.query("SELECT schemaname, tablename, indexname, indexdef FROM pg_indexes WHERE schemaname IN ('public', 'catalog') ORDER BY 1, 2, 3"),
    sql.query("SELECT schemaname, tablename, policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname IN ('public', 'catalog') ORDER BY 1, 2, 3"),
    sql.query("SELECT to_regclass('public.schema_migrations') IS NOT NULL AS has_migration_ledger, to_regclass('catalog.items') IS NOT NULL AS has_catalog"),
  ], { readOnly: true })
  console.log(JSON.stringify({ role, tables, constraints, indexes, policies, migrations }, null, 2))
}

main().catch((error: unknown) => {
  console.error('Read-only database audit failed:', error instanceof Error ? error.message : 'Unknown error')
  process.exitCode = 1
})
