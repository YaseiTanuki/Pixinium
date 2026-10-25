# Hybrid backend

Supabase owns authentication and sessions. Neon `catalog.profiles` stores profile
details and application roles: `member` (displayed as User) and `admin`.
Neon owns website content, including the existing archive. Content queries remain
in `server/repositories` and use the server-only `DATABASE_URL`.

The extensible catalog schema, entity relationships, migration workflow, and
runtime ownership rules are documented in [entity-model.md](./entity-model.md).
The application uses canonical catalog entities for all content reads.
Migration 0005 removes the obsolete archive tables and imported metadata snapshots.
Images is the content category; wallpaper, background and avatar are multiple uses.

## Supabase clients

- Client Components: import `createClient` from `@/lib/supabase/client`.
- Server Components, Server Actions, and Route Handlers: import `createClient`
  from `@/lib/supabase/server` and await it. Create a client per request.
- `proxy.ts` refreshes auth cookies and forwards the SDK's cache-prevention headers.

The connection is configured in `.env.local`; `.env.example` lists the variables
needed for another environment. Configure the same values in the deployment
environment before building. Only the publishable key belongs in browser code.

## Authorization across databases

For protected account/admin operations, verify the Supabase identity on the server
using `auth.getUser()` (check the error and require a confirmed, non-anonymous user),
then read the current role from Neon `catalog.profiles`. Set `app.user_id` to the
verified UUID in the same transaction as profile creation and selection. Never accept
a user ID from the browser as proof of identity. Supabase RLS does not protect
Neon queries. A future Neon owner identifier should reference the Supabase user
ID logically; these separate databases cannot enforce a cross-database foreign key.

No account table or role migration is required in Supabase. Existing Neon admin
assignments remain authoritative. Signup itself calls only Supabase Auth; Neon is
accessed when a confirmed account opens a protected page or performs an upload.

Existing public archive reads remain public. Login, registration, confirmation,
profiles and an admin-only category-aware content studio are implemented; provider setup and
validation requirements are in [auth-and-admin.md](./auth-and-admin.md).
Auth-changing Route Handlers must return private/no-store
responses, and authenticated pages must not use shared caching.

Reference: https://supabase.com/docs/guides/auth/server-side/creating-a-client
