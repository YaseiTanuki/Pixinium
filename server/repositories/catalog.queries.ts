// Explicit public visibility checks apply even when the connection bypasses RLS.
const cardsSelect = `SELECT
  i.view_count::int AS view_count, i.download_count::int AS download_count,
  (SELECT count(*)::int FROM catalog.collection_items saved_item
    JOIN catalog.collections saved_collection ON saved_collection.id = saved_item.collection_id
    WHERE saved_item.item_id = i.id AND saved_collection.kind = 'saved') AS collect_count,
  jsonb_build_object('id', i.id::text, 'slug', i.slug, 'title', i.title,
    'summary', i.summary, 'accentColor', i.accent_color, 'isFeatured', i.is_featured) AS item,
  jsonb_build_object('id', c.id::text, 'slug', c.slug, 'name', c.name,
    'iconKey', c.icon_key, 'artworkStyle', c.artwork_style) AS category,
  i.description, c.metadata_schema_key, i.metadata->'image_count' AS image_count,
  coalesce((SELECT jsonb_agg(jsonb_build_object('provider',ds.source_slug,'url',ds.url) ORDER BY ds.source_slug)
    FROM catalog.item_download_sources ds WHERE ds.item_id=i.id),'[]'::jsonb) AS download_sources,
  CASE WHEN c.metadata_schema_key = 'music.v1' THEN i.metadata ELSE '{}'::jsonb END AS music_metadata,
  coalesce((SELECT jsonb_agg(jsonb_build_object('itemId', f.item_id::text,
    'key', f.key, 'label', f.label, 'value', f.value, 'sortOrder', f.sort_order)
    ORDER BY f.sort_order, f.key) FROM catalog.item_facts f WHERE f.item_id = i.id), '[]') AS facts,
  coalesce((SELECT jsonb_agg(jsonb_build_object('id', t.id::text, 'slug', t.slug, 'name', t.name)
    ORDER BY t.name) FROM catalog.item_tags it JOIN catalog.tags t ON t.id = it.tag_id
    WHERE it.item_id = i.id), '[]') AS tags,
  coalesce((SELECT jsonb_agg(jsonb_build_object('id', ia.id::text, 'itemId', ia.item_id::text,
    'assetId', a.id::text, 'role', ia.role, 'altText', ia.alt_text,
    'focalX', ia.focal_x, 'focalY', ia.focal_y, 'sortOrder', ia.sort_order,
    'width', a.width, 'height', a.height, 'mimeType', a.mime_type,
    'byteSize', a.byte_size::text, 'durationSeconds', a.duration_seconds,
    'mediaType', a.media_type, 'provider', a.provider, 'externalUrl', a.external_url,
    'bucket', a.bucket, 'objectPath', a.object_path) ORDER BY ia.sort_order, ia.id)
    FROM catalog.item_assets ia JOIN catalog.assets a ON a.id = ia.asset_id
    WHERE ia.item_id = i.id), '[]') AS assets
FROM catalog.items i JOIN catalog.categories c ON c.id = i.category_id`

export const categoriesQuery = `SELECT id::text, slug, name, description, icon_key AS "iconKey",
  artwork_style AS "artworkStyle", metadata_schema_key AS "metadataSchemaKey",
  sort_order AS "sortOrder", is_active AS "isActive", created_at::text AS "createdAt", updated_at::text AS "updatedAt"
  FROM catalog.categories WHERE is_active ORDER BY sort_order, id`

const catalogConditions = `WHERE i.status = 'published' AND c.is_active
  AND ($1::text IS NULL OR c.slug = ANY(string_to_array($1, ',')))
  AND ($2::text IS NULL OR i.slug = $2)
  AND ($3::text IS NULL OR i.title ILIKE $3 OR i.summary ILIKE $3 OR c.name ILIKE $3
    OR EXISTS (SELECT 1 FROM catalog.item_tags it JOIN catalog.tags t ON t.id = it.tag_id
      WHERE it.item_id = i.id AND t.name ILIKE $3))`

export const cardsQuery = `${cardsSelect} ${catalogConditions} ORDER BY i.sort_order, i.id`

const archiveConditions = `${catalogConditions}
  AND ($4::text IS NULL OR CASE WHEN $5::text = 'any' THEN
    EXISTS (SELECT 1 FROM catalog.item_tags selected_tag
      JOIN catalog.tags t ON t.id = selected_tag.tag_id
      WHERE selected_tag.item_id = i.id
      AND (lower(t.slug) = ANY(regexp_split_to_array(lower($4), '[[:space:],]+'))
        OR lower(t.name) = ANY(regexp_split_to_array(lower($4), '[[:space:],]+'))))
    ELSE NOT EXISTS (SELECT 1 FROM regexp_split_to_table(lower($4), '[[:space:],]+') wanted(tag)
      WHERE NOT EXISTS (SELECT 1 FROM catalog.item_tags selected_tag
        JOIN catalog.tags t ON t.id = selected_tag.tag_id
        WHERE selected_tag.item_id = i.id AND (lower(t.slug) = wanted.tag OR lower(t.name) = wanted.tag))) END)`

export const archiveCountQuery = `SELECT count(*)::int AS total
  FROM catalog.items i JOIN catalog.categories c ON c.id = i.category_id ${archiveConditions}`

export const archiveTagsQuery = `SELECT t.id::text, t.slug, t.name FROM catalog.tags t
  WHERE EXISTS (SELECT 1 FROM catalog.item_tags it
    JOIN catalog.items i ON i.id = it.item_id
    JOIN catalog.categories c ON c.id = i.category_id
    WHERE it.tag_id = t.id AND i.status = 'published' AND c.is_active)
  ORDER BY t.name, t.id`

export const archivePageQuery = `${cardsSelect} ${archiveConditions}
  ORDER BY
    CASE WHEN $8::text = 'newest' THEN i.published_at END DESC NULLS LAST,
    CASE WHEN $8::text = 'views' THEN i.view_count END DESC,
    CASE WHEN $8::text = 'downloads' THEN i.download_count END DESC,
    CASE WHEN $8::text = 'title' THEN lower(i.title) END ASC,
    i.sort_order, i.id LIMIT $6::int OFFSET $7::bigint`
