# Fresh Supabase schema and private R2 deployment

Target Auth/Postgres project: `bmwqepkgfcpodckitwbw`.
Target R2 bucket: `pixinium`, account `56eb9249a6ffe1456901b2f4bb4cbc89`.
This setup creates fresh application schemas. Existing content, profiles, keys,
jobs and object bytes are not copied from the previous backend.

## Maintenance configuration

Fill ignored `.env.supabase-r2.local` with `SUPABASE_PROJECT_REF`,
`DATABASE_URL_UNPOOLED` (Supabase owner direct or Session pooler connection),
`MIGRATION_TARGET_HOST`, `R2_ENDPOINT_URL`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, and the verified `R2_BUCKET_PRIVATE` setting.
The endpoint is the R2 account URL without `/pixinium`.
Supabase's publishable Auth key is not a database password. Keep owner credentials
outside Next.js runtime env files.
The PostgreSQL adapter includes Supabase's public database CA and verifies both
the certificate chain and hostname. Maintenance URLs use `sslmode=verify-full`.
Local/Hyperdrive connections retain their own TLS configuration.

Confirm the R2 bucket privacy settings in the dashboard. For an automated check,
provide a local `CLOUDFLARE_API_TOKEN` with R2 read permission and run
`pnpm storage:verify-private`; this management token is not needed by app runtime.

## Review and initialize

```sh
pnpm db:prepare-supabase
pnpm db:init-supabase
pnpm db:init-supabase --apply
```

The first command writes `.tmp/supabase/fresh-schema.sql` without a network call.
The second inspects the confirmed target read-only. The third applies the fresh
schema and saves restricted login credentials to an ignored
`.env.supabase-runtime.<timestamp>.local` file. Passwords never go to stdout.

Initialization refuses existing `catalog`/`automation` schemas, an app migration
ledger/legacy archive or colliding app roles. It is transactional and preserves
Supabase Auth/Storage schemas. Reference data has four categories and three
download sources; user/content/job tables start empty.

If using the generated SQL in Supabase SQL Editor instead, it creates NOLOGIN app
roles; securely provision their login credentials separately. Do not put the
`postgres` owner connection into application runtime variables.

## Runtime

- `DATABASE_URL`: restricted `pixinium_runtime` connection.
- `CATALOG_ADMIN_DATABASE_URL`: restricted `pixinium_catalog_admin` connection.
- `AGENT_DATABASE_URL`: broker-only `pixinium_agent_api` connection.
- Preserve the existing Supabase Auth public URL/key and canonical site URL.
- Set `R2_*` separately. Disable r2.dev and public custom-domain access before
  confirming privacy. R2's S3 API cannot inspect these public-access settings.
- Preserve Cloudflare Access and independent agent authentication.

For Workers, Hyperdrive can offload database connection setup: bind separate
configs as `DATABASE_POOL`, `CATALOG_ADMIN_POOL` and `AGENT_POOL` for the matching
restricted roles. Disable query caching on all three configs because requests
use RLS and transaction-local identity. The driver selects only the pool matching
its configured runtime URL; maintenance/local commands keep their direct/pooler URL.
Pool IDs must be provisioned and added to Wrangler before using this option.

Initialize and verify the target, then configure hosting runtime secrets before
releasing the migration branch. Validate catalog/auth, role restrictions, file
streaming, private draft creation and idempotent replay. Fresh schema setup does
not assign an administrator or copy previous machine credentials; provision those
explicitly for the new target.
