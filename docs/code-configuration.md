# Shared application rules

- `lib/content-types.ts` owns persisted metadata schema identifiers and their UI kinds.
  Detail rendering uses the schema returned by the catalog service, never the category slug.
  New rendering kinds must have an entry in the typed detail component registry.
  Unknown schemas render the generic asset preview; metadata validation still rejects unsupported schemas.
- Category names, slugs, descriptions and available uses come from catalog data.
  Home and search show all supplied uses, in catalog order, without a frontend allowlist.
- `lib/admin/limits.ts` owns shared upload and form limits. UI messages and input attributes,
  Zod validation, cleanup, API discovery and original image processing consume these values.
- `lib/admin/content.ts` owns allowed upload extensions/MIME types. File inputs derive their
  accept lists through `acceptedFileTypes`; category-specific ZIP restrictions remain explicit.
- `lib/catalog.ts` owns catalog URL builders and display counts.
- `lib/media.ts` owns playback URL handling. External signed URLs stay unchanged.

Keep editorial copy and local styling next to their components. Extract values when they represent
a shared rule or deployment setting, rather than replacing every literal with a constant.
Historical SQL migrations are immutable snapshots and are not rewritten to import runtime configuration.
Changing runtime limits beyond database constraints requires a separate database migration.

Run `node --import tsx --test tests/*.test.ts` and `node node_modules/typescript/bin/tsc --noEmit`
after changing these contracts.
