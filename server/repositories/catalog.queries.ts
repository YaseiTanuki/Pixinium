// Explicit public visibility checks apply even when the connection bypasses RLS.
const cardsSelect = `SELECT
  jsonb_build_object('id', i.id::text, 'slug', i.slug, 'title', i.title,
    'summary', i.summary, 'accentColor', i.accent_color, 'isFeatured', i.is_featured) AS item,
  jsonb_build_object('id', c.id::text, 'slug', c.slug, 'name', c.name,
    'iconKey', c.icon_key, 'artworkStyle', c.artwork_style) AS category,
  i.description, c.metadata_schema_key, i.metadata->'image_count' AS image_count,
  CASE WHEN c.metadata_schema_key = 'music.v1' THEN i.metadata ELSE '{}'::jsonb END AS music_metadata,
  coalesce((SELECT jsonb_agg(jsonb_build_object('slug', u.slug, 'name', u.name)
    ORDER BY u.sort_order, u.slug) FROM catalog.item_uses iu
    JOIN catalog.content_uses u ON u.slug = iu.use_slug WHERE iu.item_id = i.id), '[]') AS uses,
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

const catalogConditions = `WHERE i.status = 'published' AND c.is_active
  AND ($1::text IS NULL OR c.slug = $1)
  AND ($2::text IS NULL OR i.slug = $2)
  AND ($3::text IS NULL OR i.title ILIKE $3 OR i.summary ILIKE $3 OR c.name ILIKE $3
    OR EXISTS (SELECT 1 FROM catalog.item_tags it JOIN catalog.tags t ON t.id = it.tag_id
      WHERE it.item_id = i.id AND t.name ILIKE $3)
    OR EXISTS (SELECT 1 FROM catalog.item_uses iu JOIN catalog.content_uses u ON u.slug = iu.use_slug
      WHERE iu.item_id = i.id AND u.name ILIKE $3))`

export const cardsQuery = `${cardsSelect} ${catalogConditions} ORDER BY i.sort_order, i.id`

const archiveConditions = `${catalogConditions}
  AND ($4::text IS NULL OR EXISTS (SELECT 1 FROM catalog.item_uses selected_use
    WHERE selected_use.item_id = i.id AND selected_use.use_slug = $4))`

export const archiveCountQuery = `SELECT count(*)::int AS total
  FROM catalog.items i JOIN catalog.categories c ON c.id = i.category_id ${archiveConditions}`

export const archivePageQuery = `${cardsSelect} ${archiveConditions}
  ORDER BY i.sort_order, i.id LIMIT $5::int OFFSET $6::bigint`
