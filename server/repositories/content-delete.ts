// Delete the item and its exclusive assets atomically; shared assets survive.
export const deleteContentQuery = `
WITH actor AS MATERIALIZED (
  SELECT id FROM catalog.profiles WHERE id = $1::uuid AND role = 'admin' FOR SHARE
), removed AS (
  DELETE FROM catalog.items i USING actor
  WHERE i.id = $2::bigint RETURNING i.id, i.slug, i.category_id
), assets AS (
  DELETE FROM catalog.assets a
  USING removed r
  WHERE EXISTS (SELECT 1 FROM catalog.item_assets ia WHERE ia.item_id = r.id AND ia.asset_id = a.id)
    AND NOT EXISTS (SELECT 1 FROM catalog.item_assets ia WHERE ia.asset_id = a.id AND ia.item_id <> r.id)
  RETURNING a.provider, a.bucket, a.object_path
)
SELECT r.id::text, r.slug, c.slug AS category,
  coalesce((SELECT jsonb_agg(a) FROM assets a), '[]'::jsonb) AS assets
FROM removed r JOIN catalog.categories c ON c.id = r.category_id`

// Hold the admin role and item stable until storage deletion finishes.
export const lockContentForDeletionQuery = `
WITH actor AS MATERIALIZED (
  SELECT id FROM catalog.profiles WHERE id = $1::uuid AND role = 'admin' FOR SHARE
)
SELECT i.id::text, i.slug, c.slug AS category
FROM catalog.items i JOIN catalog.categories c ON c.id = i.category_id CROSS JOIN actor
WHERE i.id = $2::bigint
FOR UPDATE OF i`

// Block asset replacement and new references while deciding which files are exclusive.
export const lockContentAssetsQuery = `
SELECT a.id FROM catalog.assets a
WHERE EXISTS (SELECT 1 FROM catalog.item_assets ia WHERE ia.item_id = $1::bigint AND ia.asset_id = a.id)
ORDER BY a.id FOR UPDATE OF a`

// Run after acquiring the locks, with a fresh READ COMMITTED snapshot.
export const exclusiveContentAssetsQuery = `
SELECT a.provider, a.bucket, a.object_path FROM catalog.assets a
WHERE EXISTS (SELECT 1 FROM catalog.item_assets ia WHERE ia.item_id = $1::bigint AND ia.asset_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM catalog.item_assets ia WHERE ia.asset_id = a.id AND ia.item_id <> $1::bigint)`
