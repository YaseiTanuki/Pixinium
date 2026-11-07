# Production preparation - 5 November 2026

## Git

- Backup: `backup/pre-production-20261105` at `3158ec9`.
- Release preparation branch: `production`.
- Local assistants, skills, MCP settings, Graphify, screenshots, browser profiles,
  local backups and one-time development scripts are excluded from production
  tracking. Skills and local artifacts remain on the workstation.
- Application source, content policies, emails, migrations, regression tests and
  operational migration/audit/staging-cleanup commands are retained.

## Neon

Project: `solitary-sound-97794541`, database: `neondb`.

- Production: `br-red-shadow-az49w76w`.
- Pre-migration backup: `backup-production-20261105`
  (`br-still-dream-azdesmdo`), created without compute.
- Rehearsal: `production-migration-check-20261105`
  (`br-polished-bread-azk6omny`), expires 6 November 2026 at 18:00 UTC.

The 20 migration files retained by this application were rehearsed on a copy of
production and then applied to production in one transaction. Checksums match
the release files. The eight existing production archive items were preserved;
no development items, profiles, collections, agent keys or job history were copied.
The four active categories and three download-source defaults are present.
Public catalog and sitemap queries were checked after migration, and RLS remains
enabled on all catalog and automation tables.

Development contains four additional historical migrations for retired Stories,
support and editorial features. Those files are not part of the current application
checkout, so those unused development structures were not copied into production.
This release follows the retained application history, not a dump of the dev DB.

## Deployment configuration

Local `.env.local` still targets development. Production migration credentials
are in ignored `.env.production-db.local`; it is not a Next.js runtime env file.
To check/apply migrations explicitly from this workstation:

```sh
node --env-file=.env.production-db.local --import tsx scripts/migrate-database.ts
```

Configure runtime environment variables from `.env.example` in the hosting secret
manager. Set production database connections, Supabase Auth callbacks/email delivery,
private storage credentials/CORS and canonical domain redirects explicitly.
No production administrator profile or machine credential was copied or issued.
The optional agent API remains inactive until its restricted login is configured.

This preparation does not publish a website, push Git branches or change the local
development DB connection. Before exposing preview deployments publicly, resolve
the preview robots/noindex policy described in the SEO review and confirm sitemap
refreshes for creation, deletion and file replacement as well as publication changes.
