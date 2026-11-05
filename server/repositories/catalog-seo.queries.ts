export const sitemapItemsQuery = `SELECT c.slug AS category, i.slug, i.updated_at::text AS "updatedAt",
  coalesce((SELECT jsonb_agg(CASE WHEN a.provider='external' THEN a.external_url
    ELSE '/api/assets/' || a.id::text || '?view=1' END ORDER BY ia.sort_order,ia.id)
    FROM catalog.item_assets ia JOIN catalog.assets a ON a.id=ia.asset_id
    WHERE ia.item_id=i.id AND ia.role='download' AND a.media_type='image'
      AND a.provider IN ('s3','external')),'[]'::jsonb) AS images
  FROM catalog.items i JOIN catalog.categories c ON c.id = i.category_id
  WHERE i.status = 'published' AND c.is_active
  ORDER BY i.id`
