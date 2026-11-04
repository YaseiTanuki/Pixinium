# Neon database review — 3 November 2026

The main catalog model is suitable for the current application. The important
release risks are environment/schema drift and excessive runtime privileges,
not a need to redesign the catalog from scratch. This review changed no live
schema, grants, rows, migration ledger entries or branches.

## Scope and evidence

- Inspected the existing `DATABASE_URL` through read-only SQL transactions.
- Verified the matching endpoint/branch through Neon project metadata:
  `dev`, branch `br-broad-lab-azyaalyp`, endpoint `ep-falling-dust-azsj4b0c`.
- `DATABASE_URL`, `DATABASE_URL_UNPOOLED` and `CATALOG_ADMIN_DATABASE_URL`
  currently target that same development endpoint as `neondb_owner`.
- `.neon` CLI context selects `production`; `NEON_BRANCH` in the local
  environment says `dev`. The actual URL target, not either label alone,
  determines the application's database.
- Read production's current schema through the Neon schema API for database
  `neondb`, branch `br-red-shadow-az49w76w`. This retrieved schema definitions
  only, not production table contents or new connection credentials.
- Compared local migration files against live ledger names and normalized
  SHA-256 checksums. Inspected constraints, indexes, RLS policies, triggers,
  function ACLs, aggregate counts and relevant application consumers.
- Used Neon `table-sizes` and `unused-indexes` read-only diagnostics.
- Ran the in-memory schema suite: 19 tests passed. It reconstructs the local
  15-file history, not all 19 migrations recorded on the live dev branch.

No authenticated end-to-end cross-account test, physical storage-object audit,
production row-count review or large-dataset load test was performed.

## Findings, in order of priority

### P1 — Production has not received the current catalog schema

The production schema API returned only `public.archive_items`, containing the
legacy title/category/meta/image/crop/color/accent/sort_order columns. It did
not contain `catalog` tables or `public.schema_migrations`.

The application reads `catalog.items`, `catalog.categories`, profiles, assets
and other catalog relations. Pointing the current code at this production
branch as it stands would therefore fail with missing relations. Development
data is not automatically propagated into a parent production branch.

Before release, explicitly choose the production data source, preserve existing
data and rehearse the chosen migrations/cutover on an isolated branch. Do not
assume that copying `.env.local` or changing `NEON_BRANCH` performs a cutover.

### P1 — Runtime uses an owner with BYPASSRLS

The actual connected `neondb_owner` has `rolbypassrls=true`,
`rolcreaterole=true` and `rolcreatedb=true`. All 15 catalog tables have RLS
enabled, but that owner bypasses it. This includes `profiles`, `collections`
and `collection_items`; having policies does not enforce isolation for this
connection role.

This is a database defense-in-depth gap, not proof of an exploited public
data leak: the application also verifies identities and filters rows in its
server code. Runtime should use a separate least-privilege login without
ownership, BYPASSRLS or membership that permits switching into an owner role.
Keep privileged administrative operations separate.

Do not switch the URL blindly. Current public counters write through
`DATABASE_URL`, and `collect_count` reads across saved collections. A restricted
role will require deliberate grants and an appropriate mechanism for those
operations without granting access to other users' private records. Test
profiles, saved collections, counters, avatars and admin operations together.

Relevant consumers:

- `server/services/auth.service.ts`: verified account and transaction-local
  `app.user_id` context.
- `server/services/catalog.service.ts`: runtime connection and view writes.
- `server/repositories/catalog.queries.ts`: aggregate collection counts.
- `app/api/assets/[id]/route.ts`: download counter writes.

PostgreSQL explicitly documents that BYPASSRLS roles bypass row policies:
https://www.postgresql.org/docs/current/ddl-rowsecurity.html

### P1 — Four applied migrations are missing from source

Development records 19 applied migrations; `db/migrations/` contains 15.
All 15 existing files match their recorded checksums, with no pending local
files and no checksum mismatches. However, the following applied files are
absent locally:

- `0014_stories_content_type.sql`
- `0015_story_chapters.sql`
- `0017_support_and_takedowns.sql`
- `0018_editorial_collection_metadata.sql`

Consequently, a fresh migration from this checkout does not recreate the live
development schema. A "no pending migrations" result would not detect the
missing-source condition: `scripts/migrations.ts` iterates local files and
checks their checksums, but does not reject ledger entries absent from source.

Recover the original files with matching checksums if retaining their history.
If the corresponding features were intentionally removed, preserve historical
migrations and retire their schema through a new, reviewed migration after
deciding what data must be retained. Do not delete ledger rows or fabricate new
contents under an already-applied migration name.

The two distinct `0014_...` names currently work because the runner keys by full
filename. Avoid reusing migration numbers in future to keep ordering clear.

### P2 — Usage counters change the content modification timestamp

Live trigger `items_updated` runs before every UPDATE on `catalog.items` and
calls `catalog.touch_updated_at()`, which assigns `clock_timestamp()`.
`recordItemView()` and the asset-delivery route update view/download counters
on that same table. As a result, those writes also change `updated_at`.

`server/repositories/catalog-seo.queries.ts` exposes that timestamp and
`app/sitemap.ts` uses it as `lastModified`. A visit/download can therefore
look like a content edit in the sitemap. This conclusion follows from the
live trigger and current code; no counter was incremented for this audit.

Use a content-specific timestamp or restrict the timestamp trigger to relevant
content changes. Keep statistics updates from falsely marking content as edited.
The current data volume does not justify a large analytics subsystem solely
to address this issue.

### P2 — Retained feature schema is ahead of the current application surface

Development still contains:

- An active `stories` category, one published story and one `story_chapters`
  row. Current queries explicitly exclude `stories`; `CONTENT_SCHEMAS` and
  metadata validation no longer declare that type. The schema test explicitly
  verifies that removed stories stay hidden.
- `support_requests`, `support_events`, `support_rate_limits` and
  `content_restrictions`, plus related functions and triggers. The support and
  editorial service modules referenced by their earlier implementation are
  absent from this checkout. Request/event/restriction counts are zero;
  one rate-limit row remains.
- `collections.title`, `collections.description` and
  `collection_items.sort_order`, restored by migration 0018 but not represented
  by the current minimal collection types.

These are not evidence of corruption, and empty tables are not permission to
delete a feature. Decide whether these features are intentionally retained or
retired; then reconcile code, types, migrations and data. Do not automatically
restore a removed UI or delete stored stories.

The TypeScript `ItemUse` interface also remains in `lib/entities/catalog.ts`,
although the old uses tables have been removed. This is minor type cleanup,
not a missing database migration.

### P3 — One check constraint is not validated

`catalog.collections.editorial_public_metadata_check` remains `NOT VALID`.
The aggregate check found zero public editorial collections violating it.
PostgreSQL still enforces the check for new/changed rows, but the constraint
does not attest that all pre-existing rows were scanned.

After reconciling migration history and deciding the future of editorial
collections, validate this constraint through a tracked migration if retained.
It is not evidence that invalid editorial data currently exists.

## What is already sound

- Categories, items, assets, join tables, profiles and collections have clear
  responsibilities. Asset locations are separate from the item, and binary
  file content is not stored in catalog rows.
- Item slugs are unique per category, matching current category/item URLs.
- Asset provider/location checks reject ambiguous external/storage locations;
  storage paths have a provider/bucket/path unique index.
- One cover per item is enforced by a partial unique index.
- Join tables have primary keys and foreign keys; no missing leading FK index
  was found by the catalog inspection. No invalid or unready index was found.
- Profiles are local references to externally authenticated Supabase UUIDs;
  no impossible cross-database foreign key to Supabase is assumed.
- Saved collections have a unique owner index and cannot be public.
- All 15 catalog tables have RLS enabled. Private support tables with no public
  policies are intentionally default-deny for a non-bypassing role; this is not
  itself a reason to add permissive policies.
- No table grants to PUBLIC were found in the reviewed schemas. The
  SECURITY DEFINER publication-restriction trigger has a fixed search path and
  no public EXECUTE grant; it was not treated as an exposed public RPC.
- The former `content_uses` / `item_uses` tables are absent; labels are held in
  `tags` and `item_tags` as expected.

## Aggregate snapshot of development

| Relation / check | Result |
| --- | ---: |
| Catalog tables | 15 |
| Categories | 5, including the hidden stories category |
| Items | 16, all published; 15 are in the current non-story surface |
| Assets | 36, all using the configured S3-compatible provider |
| Item-asset associations | 36 |
| Tags / item-tag associations | 27 / 57 |
| Profiles / collections / saved associations | 2 / 1 / 4 |
| Orphan item-asset and item-tag associations | 0 |
| Collections without their referenced profile | 0 |
| Assets without any item association | 0 |
| Published non-story items without a cover | 0 |
| Usernames outside the current 3–12 character format | 0 |
| Invalid indexes | 0 |
| Missing leading FK indexes | 0 |

Some small indexes have zero recorded scans. With only 16 development items,
that is not sufficient evidence to remove them; foreign-key, ordering and
future workflow needs still matter. No new performance index is recommended
solely from this snapshot.

## Recommended next actions

1. Reconcile the four missing migration files and explicitly decide the status
   of removed stories/support/editorial features.
2. Rehearse the intended production schema and data cutover on an isolated
   branch, including backups and storage references; verify the target before
   changing application credentials.
3. Implement/test restricted runtime credentials and the required narrowly
   scoped counter/aggregate paths; retain separately authorized admin access.
4. Correct content modification timestamps and validate retained constraints.
5. Repeat schema, permission and end-to-end checks against the final release
   branch. A clean local test suite does not prove that production matches it.

## Follow-up: independent agent activation

Later on 2026-11-03, migration `0019_independent_agents.sql` was tested on a
disposable child branch and applied to development (`br-broad-lab-azyaalyp`).
Development now has 20 migration ledger entries and 16 local migration files;
the same four historic source files remain missing. No historic checksum was
rewritten. Production was not changed.

Agent requests now use the dedicated `pixinium_agent_api` login through
`AGENT_DATABASE_URL`, without BYPASSRLS, table access or administrator profiles.
Its allowlisted database functions enforce key scopes, expiry/revocation,
category ownership, quotas, idempotency and publication provenance. Real-login
permission checks and HTTP upload/publication/replay/revocation tests passed.
The disposable test files and branch were cleaned up. Development item, asset,
profile and collection counts remained 16, 36, 2 and 1 after activation.

This resolves the agent-specific credential separation. The ordinary application
`DATABASE_URL` and `CATALOG_ADMIN_DATABASE_URL` still require the separate runtime
privilege work described above; production cutover and migration-history repair
remain outstanding. See `agent-upload-api.md` for activation and key management.
