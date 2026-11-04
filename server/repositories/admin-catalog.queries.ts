// Only execute after the caller has required admin:access, using the admin connection.
const conditions = `FROM catalog.items i JOIN catalog.categories c ON c.id = i.category_id
  WHERE ($1::text IS NULL OR i.title ILIKE $1 OR i.summary ILIKE $1 OR i.description ILIKE $1)
    AND ($2::text IS NULL OR c.slug = ANY(string_to_array($2, ',')))
    AND ($3::text IS NULL OR i.status = $3)
    AND ($4::text IS NULL OR CASE WHEN $5::text = 'any' THEN
      EXISTS (SELECT 1 FROM catalog.item_tags it JOIN catalog.tags t ON t.id = it.tag_id
        WHERE it.item_id = i.id AND (lower(t.slug) = ANY(regexp_split_to_array($4, '[[:space:],]+'))
          OR lower(t.name) = ANY(regexp_split_to_array($4, '[[:space:],]+'))))
      ELSE NOT EXISTS (SELECT 1 FROM regexp_split_to_table($4, '[[:space:],]+') wanted(tag)
        WHERE NOT EXISTS (SELECT 1 FROM catalog.item_tags it JOIN catalog.tags t ON t.id = it.tag_id
          WHERE it.item_id = i.id AND (lower(t.slug) = wanted.tag OR lower(t.name) = wanted.tag))) END)`

export const adminCatalogCountQuery = `SELECT count(*)::int AS total ${conditions}`
export const adminCatalogStatusCountsQuery = `SELECT status, count(*)::int AS total FROM catalog.items GROUP BY status`
export const adminCatalogPageQuery = `SELECT i.id::text, i.title, i.status, i.slug, c.slug AS category ${conditions}
  ORDER BY
    CASE WHEN $8::text = 'oldest' THEN i.created_at END ASC,
    CASE WHEN $8::text = 'title' THEN lower(i.title) END ASC,
    CASE WHEN $8::text = 'views' THEN i.view_count END DESC,
    CASE WHEN $8::text = 'downloads' THEN i.download_count END DESC,
    i.created_at DESC, i.id DESC LIMIT $6::int OFFSET $7::bigint`

export const adminCatalogCategoriesQuery = `SELECT id::text, slug, name FROM catalog.categories ORDER BY sort_order, id`
export const adminCatalogTagsQuery = `SELECT t.id::text, t.slug, t.name FROM catalog.tags t
  WHERE EXISTS (SELECT 1 FROM catalog.item_tags it WHERE it.tag_id = t.id) ORDER BY t.name, t.id`
