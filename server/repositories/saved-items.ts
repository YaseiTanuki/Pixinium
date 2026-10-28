export const savedItemsQuery = `
  SELECT ci.item_id::text AS id
  FROM catalog.collection_items ci
  JOIN catalog.collections c ON c.id = ci.collection_id
  JOIN catalog.items i ON i.id = ci.item_id
  JOIN catalog.categories category ON category.id = i.category_id
  WHERE c.owner_user_id = $1::uuid AND c.kind = 'saved'
    AND i.status = 'published' AND category.is_active
  ORDER BY ci.added_at DESC, ci.item_id DESC`

export const ensureSavedCollectionQuery = `
  INSERT INTO catalog.collections (owner_user_id, kind, slug, title)
  VALUES ($1::uuid, 'saved', 'saved', 'Saved finds')
  ON CONFLICT (owner_user_id) WHERE kind = 'saved' DO NOTHING`

export const collectItemQuery = `
  INSERT INTO catalog.collection_items (collection_id, item_id)
  SELECT c.id, i.id FROM catalog.collections c
  JOIN catalog.items i ON i.id = $2::bigint
  JOIN catalog.categories category ON category.id = i.category_id
  WHERE c.owner_user_id = $1::uuid AND c.kind = 'saved'
    AND i.status = 'published' AND category.is_active
  ON CONFLICT (collection_id, item_id) DO NOTHING`

export const uncollectItemQuery = `
  DELETE FROM catalog.collection_items ci USING catalog.collections c
  WHERE ci.collection_id = c.id AND c.owner_user_id = $1::uuid
    AND c.kind = 'saved' AND ci.item_id = $2::bigint`
