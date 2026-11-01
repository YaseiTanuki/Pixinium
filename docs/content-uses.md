# Intended uses are tags

Migration `0016_merge_uses_into_tags.sql` merges the former suitable-for model into
`catalog.tags` and `catalog.item_tags`, then removes `catalog.content_uses` and
`catalog.item_uses`. All definitions and associations are copied, including archived
items and category-like labels. Existing tag names and IDs win on a matching slug;
duplicate item/tag links are kept only once. Categories and canonical item URLs do
not change. New content receives only the tags supplied by its author.

The runner executes the backfill, verification, table removal and migration ledger
update in one transaction. A failed copy or unexpected dependency rolls it back.
The old migration files remain unchanged for checksum verification and fresh setup.

Run `node --env-file=.env.local --import tsx scripts/migrate-content-tags.ts` to
dry-run with rollback and verify all definitions, associations and existing tags
before committing through the standard migration runner. Alternatively, run
`pnpm.cmd db:migrate` with the configured `DATABASE_URL_UNPOOLED`, then
`node --env-file=.env.local scripts/check-catalog-migration.mjs` to verify the result.
Roll out the matching application code together with this migration: older code
queries the removed tables. Restoring the former model requires a database restore
or a deliberate reverse migration; ordinary tags no longer distinguish their origin.

Search filters use `/search?tag=wallpaper`. Studio and the agent API use tags
only; `/api/agent/catalog` returns available tags, and content requests accept
`tags: [{slug, name}]` with at most 40 entries to accommodate merged labels.

The deployment runtime role needs SELECT on `catalog.tags` and `catalog.item_tags`.
The trusted writer also needs the existing tag and item-tag write privileges.
