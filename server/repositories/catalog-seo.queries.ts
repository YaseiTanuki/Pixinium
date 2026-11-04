export const sitemapItemsQuery = `SELECT c.slug AS category, i.slug, i.updated_at::text AS "updatedAt"
  FROM catalog.items i JOIN catalog.categories c ON c.id = i.category_id
  WHERE i.status = 'published' AND c.is_active
  ORDER BY i.id`
