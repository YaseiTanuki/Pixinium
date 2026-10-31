export const editableContentQuery = `
SELECT i.id::text, i.title, i.summary, i.description, i.slug, c.slug AS category, c.metadata_schema_key,
  coalesce((SELECT jsonb_agg(u.use_slug ORDER BY u.use_slug) FROM catalog.item_uses u WHERE u.item_id = i.id), '[]'::jsonb) AS uses,
  coalesce((SELECT jsonb_agg(t.name ORDER BY t.name) FROM catalog.item_tags it JOIN catalog.tags t ON t.id = it.tag_id WHERE it.item_id = i.id), '[]'::jsonb) AS tags,
  coalesce((SELECT jsonb_agg(jsonb_build_object('key', f.key, 'label', f.label, 'value', f.value) ORDER BY f.sort_order, f.key)
    FROM catalog.item_facts f WHERE f.item_id = i.id), '[]'::jsonb) AS facts,
  coalesce((SELECT jsonb_agg(jsonb_build_object('label', ia.alt_text, 'role', ia.role, 'mediaType', a.media_type) ORDER BY ia.sort_order, ia.id)
    FROM catalog.item_assets ia JOIN catalog.assets a ON a.id = ia.asset_id WHERE ia.item_id = i.id), '[]'::jsonb) AS files
FROM catalog.items i JOIN catalog.categories c ON c.id = i.category_id
WHERE i.id = $1::bigint`

// One statement: text, uses, tags and facts change together or not at all.
// Relations are diffed (delete missing, upsert wanted) so no CTE depends on another's execution order.
// $4 is false for categories whose facts are generated from the files; $5 replaces item metadata when not null.
export const currentAssetIdsQuery = `
SELECT coalesce(jsonb_agg(ia.asset_id::text), '[]'::jsonb) AS ids FROM catalog.item_assets ia WHERE ia.item_id = $1::bigint`

// File replacement runs as ordered statements in one transaction: a single statement cannot
// swap the unique cover link, and the old links must be gone before orphaned assets are removed.
const adminActor = `EXISTS (SELECT 1 FROM catalog.profiles WHERE id = $1::uuid AND role = 'admin')`
const unlinkAssetsQuery = `DELETE FROM catalog.item_assets WHERE item_id = $2::bigint AND ${adminActor}`
// Only assets this item referenced, and no other item still shares, are returned for storage cleanup.
const removeOrphanAssetsQuery = `DELETE FROM catalog.assets a WHERE a.id = ANY($3::bigint[]) AND ${adminActor} AND $2::bigint > 0
  AND NOT EXISTS (SELECT 1 FROM catalog.item_assets o WHERE o.asset_id = a.id)
  RETURNING a.provider, a.bucket, a.object_path`
const attachAssetsQuery = `
WITH input AS (SELECT $3::jsonb AS doc), assets AS (
  INSERT INTO catalog.assets(provider, bucket, object_path, media_type, mime_type, byte_size, width, height, duration_seconds)
  SELECT 's3', $4, a->>'path', a->>'mediaType', a->>'mime', (a->>'byteSize')::bigint,
    (a->>'width')::integer, (a->>'height')::integer, (a->>'durationSeconds')::numeric
  FROM input CROSS JOIN LATERAL jsonb_array_elements(doc) a
  WHERE ${adminActor} AND EXISTS (SELECT 1 FROM catalog.items WHERE id = $2::bigint)
  RETURNING id, object_path
)
INSERT INTO catalog.item_assets(item_id, asset_id, role, alt_text, focal_x, focal_y, sort_order)
SELECT $2::bigint, assets.id, a->>'role', a->>'altText', (a->>'focalX')::numeric, (a->>'focalY')::numeric, (ord - 1)::integer
FROM input CROSS JOIN LATERAL jsonb_array_elements(doc) WITH ORDINALITY AS entries(a, ord)
JOIN assets ON assets.object_path = a->>'path'`

export type ContentEdit = {
  actor: string; id: string; text: unknown; editFacts: boolean
  files?: { oldAssetIds: string[]; attachments: unknown[]; bucket: string; metadata: unknown }
}

/** Statements to run, in order, inside one transaction. The text update is always last and returns the saved row. */
export function updateContentStatements(edit: ContentEdit): Array<[string, unknown[]]> {
  const update: [string, unknown[]] = [updateContentQuery, [edit.actor, edit.id, JSON.stringify(edit.text), edit.editFacts,
    edit.files?.metadata != null ? JSON.stringify(edit.files.metadata) : null]]
  if (!edit.files) return [update]
  const { oldAssetIds, attachments, bucket } = edit.files
  return [
    [unlinkAssetsQuery, [edit.actor, edit.id]],
    [removeOrphanAssetsQuery, [edit.actor, edit.id, oldAssetIds]],
    [attachAssetsQuery, [edit.actor, edit.id, JSON.stringify(attachments), bucket]],
    update,
  ]
}

export const updateContentQuery = `
WITH actor AS MATERIALIZED (
  SELECT id FROM catalog.profiles WHERE id = $1::uuid AND role = 'admin' FOR SHARE
), input AS (SELECT $3::jsonb AS doc), item AS (
  UPDATE catalog.items i SET title = doc->>'title', summary = doc->>'summary',
    description = coalesce(nullif(doc->>'description', doc->>'summary'), ''),
    metadata = coalesce($5::jsonb, i.metadata)
  FROM input CROSS JOIN actor
  WHERE i.id = $2::bigint RETURNING i.id, i.slug, i.category_id
), wanted_uses AS (
  SELECT item.id AS item_id, selected.u AS use_slug FROM item CROSS JOIN input
  CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(doc->'uses', '[]'::jsonb)) AS selected(u)
  UNION
  SELECT item.id, u.slug FROM item JOIN catalog.categories c ON c.id = item.category_id
  JOIN catalog.content_uses u ON u.slug = c.slug
), removed_uses AS (
  DELETE FROM catalog.item_uses iu USING item
  WHERE iu.item_id = item.id AND NOT EXISTS (SELECT 1 FROM wanted_uses w WHERE w.use_slug = iu.use_slug) RETURNING 1
), added_uses AS (
  INSERT INTO catalog.item_uses(item_id, use_slug) SELECT item_id, use_slug FROM wanted_uses
  ON CONFLICT DO NOTHING RETURNING 1
), tags AS (
  INSERT INTO catalog.tags(slug, name)
  SELECT t->>'slug', t->>'name' FROM item CROSS JOIN input CROSS JOIN LATERAL jsonb_array_elements(doc->'tags') t
  ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug RETURNING id
), removed_tags AS (
  DELETE FROM catalog.item_tags it USING item
  WHERE it.item_id = item.id AND NOT EXISTS (SELECT 1 FROM tags WHERE tags.id = it.tag_id) RETURNING 1
), added_tags AS (
  INSERT INTO catalog.item_tags(item_id, tag_id) SELECT item.id, tags.id FROM item CROSS JOIN tags
  ON CONFLICT DO NOTHING RETURNING 1
), removed_facts AS (
  DELETE FROM catalog.item_facts f USING item CROSS JOIN input
  WHERE $4::boolean AND f.item_id = item.id
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(doc->'facts') e WHERE e->>'key' = f.key) RETURNING 1
), saved_facts AS (
  INSERT INTO catalog.item_facts(item_id, key, label, value, sort_order)
  SELECT item.id, f->>'key', f->>'label', f->>'value', (ord-1)::integer
  FROM item CROSS JOIN input CROSS JOIN LATERAL jsonb_array_elements(doc->'facts') WITH ORDINALITY AS entries(f, ord)
  WHERE $4::boolean
  ON CONFLICT (item_id, key) DO UPDATE SET label = EXCLUDED.label, value = EXCLUDED.value, sort_order = EXCLUDED.sort_order
  RETURNING 1
)
SELECT item.id::text, item.slug, c.slug AS category FROM item JOIN catalog.categories c ON c.id = item.category_id`
