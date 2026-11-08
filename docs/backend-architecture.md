# Supabase and Cloudflare R2

Supabase Auth owns identities and sessions. Supabase Postgres owns application
schemas `catalog` and `automation`: profiles, roles, content metadata, collections
and independent agent jobs. Private Cloudflare R2 stores uploaded bytes, generated
thumbnails and ZIPs. Supabase Storage is not used.

`lib/database.ts` uses the standard PostgreSQL `pg` driver with parameterized lazy
queries. Transaction-local `app.user_id` settings, profile changes and reads run
on the same connection. Connections close after each query/transaction instead
of being shared across Workers requests. Use the Supabase Session pooler for
IPv4 connectivity; Hyperdrive can be added for Workers connection pooling.

Use separate restricted credentials for public runtime, catalog writer and agent
broker. Owner credentials are maintenance-only. See [production.md](production.md).
The server verifies `auth.getUser()`, requires a confirmed non-anonymous user, and
reads the current role from `catalog.profiles`. No browser-supplied identity grants
authority. Personal data uses RLS and transaction-local identity. Catalog writes
remain server-only behind application permission checks. Agents use broker
functions rather than human login or direct table grants.

The existing Supabase browser/server clients and Auth cookies are preserved.
Authenticated pages and auth-changing responses remain private and unshared.
Public file routes check publication before streaming private R2 objects.

Fresh initialization creates application schemas and reference data only. It
preserves Supabase Auth and copies no old content, profiles, API keys or jobs.
New administrator and machine-agent provisioning is a separate step.
