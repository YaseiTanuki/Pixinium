# Hybrid backend

Supabase owns authentication, sessions, and data needed by Supabase features.
Neon owns website content, including the existing archive. Content queries remain
in `server/repositories` and use the server-only `DATABASE_URL`.

The extensible catalog schema, entity relationships, migration workflow, and
runtime ownership rules are documented in [entity-model.md](./entity-model.md).
Its additive migration and TypeScript contracts are implemented; the current
archive UI continues using the legacy table until the documented cutover.

## Supabase clients

- Client Components: import `createClient` from `@/lib/supabase/client`.
- Server Components, Server Actions, and Route Handlers: import `createClient`
  from `@/lib/supabase/server` and await it. Create a client per request.
- `proxy.ts` refreshes auth cookies and forwards the SDK's cache-prevention headers.

The connection is configured in `.env.local`; `.env.example` lists the variables
needed for another environment. Configure the same values in the deployment
environment before building. Only the publishable key belongs in browser code.

## Authorization across databases

For protected Neon operations, verify the Supabase identity on the server using
`auth.getClaims()` (check the error and require `data?.claims?.sub`), then enforce
ownership/permissions in the Neon query using that verified subject. Never accept
a user ID from the browser as proof of identity. Supabase RLS does not protect
Neon queries. A future Neon owner identifier should reference the Supabase user
ID logically; these separate databases cannot enforce a cross-database foreign key.

Existing public archive reads remain public. This setup adds clients and session
refresh infrastructure; login UI, provider configuration, and user-owned content
are separate features. Auth-changing Route Handlers must return private/no-store
responses, and authenticated pages must not use shared caching.

Reference: https://supabase.com/docs/guides/auth/server-side/creating-a-client
