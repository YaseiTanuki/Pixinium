export const sitemapItemsQuery = `SELECT c.slug AS category, i.slug,
  coalesce((SELECT jsonb_agg(CASE WHEN a.provider='external' THEN a.external_url
    ELSE '/api/assets/' || a.id::text || '?view=1' END ORDER BY ia.sort_order,ia.id)
    FROM catalog.item_assets ia JOIN catalog.assets a ON a.id=ia.asset_id
    WHERE ia.item_id=i.id AND ia.role='download' AND a.media_type='image'
      AND a.provider IN ('s3','external')),
    (SELECT jsonb_build_array(CASE WHEN a.provider='external' THEN a.external_url
      ELSE '/api/assets/' || a.id::text END)
      FROM catalog.item_assets ia JOIN catalog.assets a ON a.id=ia.asset_id
      WHERE ia.item_id=i.id AND ia.role='cover' AND a.media_type='image'
        AND a.provider IN ('s3','external') AND c.metadata_schema_key <> 'images.v1'
      ORDER BY ia.sort_order,ia.id LIMIT 1),'[]'::jsonb) AS images
  FROM catalog.items i JOIN catalog.categories c ON c.id = i.category_id
  WHERE i.status = 'published' AND c.is_active
  ORDER BY i.id`
