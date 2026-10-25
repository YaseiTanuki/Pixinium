# Multiple uses for one find

An item has a content category (Images, Music or Games) for metadata validation.
Wallpaper is a use, not an image category. Image detail URLs use `/items/images/...`.
`catalog.content_uses` contains the available uses; `catalog.item_uses` links each
item to any number of them. The initial choices are Wallpaper, Background and
Avatar. These are independent of an attachment's cover/gallery/download role.
The same item, assets, saved ID and URL are reused across all its uses.

Migration `0004_content_uses.sql` backfills Wallpaper for existing items in the
Wallpapers category. `0005_remove_legacy_catalog.sql` then changes that category
to Images, removes metadata snapshots and drops both obsolete archive tables.
There are no redirects for the old wallpaper URLs. It does not infer Background or Avatar suitability. Admin
Studio accepts multiple uses for new items. New choices can be added to the lookup
table through a migration without changing the form or validation code. Existing
items can have links added by a trusted catalog writer; there is no edit UI yet.

## Rollout

Test the migration on an isolated Neon branch using the existing migration runner
and a direct connection, then apply it before deploying the updated app. Earlier
migration files are unchanged. Runtime access grants on existing tables do not
automatically extend to these new tables. For the documented runtime role, apply:

```sql
GRANT SELECT ON catalog.content_uses, catalog.item_uses TO pixinium_runtime;
```

Use the actual runtime role name if different. The existing trusted catalog owner
connection writes links; no browser or ordinary runtime write policy is added.
If the deployment uses a separate restricted admin writer, grant it SELECT on
`catalog.content_uses` and SELECT/INSERT on `catalog.item_uses` as well.
RLS exposes links only for published items in active categories.

Verify the schema/content suites, a three-use upload, each search filter, draft
invisibility, and existing item URLs before production rollout. This change has
been applied to the configured Neon development database on 2026-10-25. Migrations
0004 and 0005 are recorded in its ledger. Post-migration checks confirmed all three
uses, the Images category, removal of both legacy tables and legacy metadata,
and read access through DATABASE_URL. All 20 local schema/content tests passed.

The configured DATABASE_URL currently uses neondb_owner (BYPASSRLS); use a
restricted runtime role before relying on RLS for a production deployment.

Migration 0006 adds Images, Music and Games as broad uses, and backfills their
links from each item's category. New studio uploads automatically receive their
matching broad use, in addition to any selected uses, without duplicate links.
The home and search Showing bars filter by use; the separate search dropdown
is removed. Browse links use `/search?use=...`. Categories still select metadata
validation and the item detail route.

Admin Studio generates item slugs from the title, with no manual URL field.
Within a category, repeated titles become `sunset`, `sunset-1`, `sunset-2`, etc.
The existing `(category_id, slug)` unique constraint prevents races; the writer
rechecks available suffixes and retries only that constraint's conflict. Drafts
and archived items also reserve their slugs. Uses do not participate in URL creation.
