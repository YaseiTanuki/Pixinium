import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { readMigrations } from './migrations'

export async function freshSupabaseSchema() {
  const migrations = await readMigrations()
  const roles = await readFile('db/runtime-roles.sql', 'utf8')
  return `-- Fresh Pixinium schemas for Supabase. Contains no existing content or credentials.
-- Run only in the confirmed Supabase project. auth/storage schemas are not changed.
BEGIN;
SELECT pg_advisory_xact_lock(724902846291::bigint);
DO $$ BEGIN
  IF to_regnamespace('catalog') IS NOT NULL OR to_regnamespace('automation') IS NOT NULL OR to_regclass('public.schema_migrations') IS NOT NULL OR to_regclass('public.archive_items') IS NOT NULL THEN
    RAISE EXCEPTION 'Target is not empty: existing application schemas or migration ledger must be reviewed first.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('pixinium_runtime','pixinium_catalog_admin','pixinium_agent','pixinium_agent_api')) THEN
    RAISE EXCEPTION 'Application roles already exist: review role ownership before fresh initialization.';
  END IF;
END $$;
CREATE TABLE public.schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON public.schema_migrations FROM PUBLIC;
${migrations.map(m => `\n-- ${m.name}\n${m.sql}\nINSERT INTO public.schema_migrations(name,checksum) VALUES ('${m.name}','${m.checksum}');`).join('\n')}
${roles}
COMMIT;
`
}

async function main() {
  await mkdir('.tmp/supabase', { recursive: true })
  await writeFile('.tmp/supabase/fresh-schema.sql', await freshSupabaseSchema())
  console.log('Prepared .tmp/supabase/fresh-schema.sql. No database connection was made.')
}
if (process.argv[1]?.replaceAll('\\', '/').endsWith('/prepare-supabase-schema.ts')) {
  main().catch(() => { console.error('Could not prepare the fresh Supabase schema.'); process.exitCode = 1 })
}
