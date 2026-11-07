# Pixinium

Next.js application for the public catalog, account collections, admin studio and
the server-side agent publishing API.

## Production

Use Node.js 24 or newer and the pnpm version declared in `package.json`.
Configure the hosting environment using `.env.example`. Secrets are never tracked.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Set `NODE_ENV=production` when building. Use the pooled production `DATABASE_URL`
for runtime reads and a separate server-only `CATALOG_ADMIN_DATABASE_URL` for the
admin writer. Database URLs must all target the intended Neon production branch.
Migrations require the direct `DATABASE_URL_UNPOOLED` and its verified hostname in
`MIGRATION_TARGET_HOST`; `NEON_BRANCH` is only a safety label, not a connection switch.

```sh
pnpm db:migrate
```

The runner checks migration checksums and applies the retained SQL history in one
transaction. Back up production and rehearse on a Neon branch before migrating.
Do not copy local development credentials or test content into production.

Configure Supabase Auth redirect URLs and email delivery, a private S3-compatible
bucket and server-side storage credentials before enabling uploads. The optional
`AGENT_DATABASE_URL` must use a restricted broker login, not the database owner.
Agent client tools, API setup helpers, skills, MCP configuration, browser profiles,
screenshots and local backups are excluded from this branch; the publishing API
and its database migration history remain part of the application.

Run regression checks with `node --import tsx --test --test-concurrency=1 tests/*.test.*`
and `pnpm exec tsc --noEmit`. See [SEO configuration](docs/seo.md),
[storage](docs/object-storage.md) and [authentication/admin](docs/auth-and-admin.md).
