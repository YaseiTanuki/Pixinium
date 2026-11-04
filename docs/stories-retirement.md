# Stories retirement

Stories is removed from the application and catalog by
`db/migrations/0021_remove_stories.sql`. Historical migrations and their checksum
ledger entries remain unchanged.

The migration removes story items and their dependent facts, tags, collection
links and provenance; drops `catalog.story_chapters`; and deletes assets only
when no surviving item references them. It removes the unused `stories` tag.
Shared assets and unrelated content stay unchanged. Agent allowlists lose the
retired category ID without gaining new permissions. An agent left with no
categories is disabled. Existing story job receipts stop the transaction for
review rather than being silently erased.

Public catalog/sitemap queries, agent setup and broker functions no longer
contain a special hidden Stories category. The admin category icon mapping no
longer includes it. New installations do not create the retired tables/category.

Before rollout, inspect `public.schema_migrations`, verify checksums and pending
scope, and back up story rows and any exclusive stored files. Use the existing
direct `DATABASE_URL_UNPOOLED` migration connection. Test the migration in a
transaction and roll it back before committing it. Unexpected DDL dependencies
stop removal because the table drop does not use `CASCADE`.

Development rollout on 2026-11-05 (Asia/Bangkok), branch
`br-broad-lab-azyaalyp`: removed one category, one item, one chapter and two
exclusive stored assets. The database snapshot and original file copies are in
the ignored local directory `.tmp/stories-retirement-2026-11-04T17-27-59-400Z/`.
Unrelated rows were compared before commit and remained unchanged. Production
was not modified. The backup directory is local and is not shipped with code.

Validation: `tests/remove-stories.test.ts` covers existing chapter data,
exclusive/shared assets, agent allowlist cleanup, disabled empty identities,
safe abort on historical jobs and fresh/repeated execution. Catalog and
independent-agent regression tests cover the updated reads and authorization.
