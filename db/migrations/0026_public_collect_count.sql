-- Saved collections stay private; public cards may read only their aggregate.
CREATE FUNCTION catalog.public_collect_count(target_item_id bigint) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT count(*)::integer
  FROM catalog.collection_items ci
  JOIN catalog.collections c ON c.id = ci.collection_id AND c.kind = 'saved'
  JOIN catalog.items i ON i.id = ci.item_id AND i.status = 'published'
  JOIN catalog.categories category ON category.id = i.category_id AND category.is_active
  WHERE ci.item_id = target_item_id;
$$;
REVOKE ALL ON FUNCTION catalog.public_collect_count(bigint) FROM PUBLIC;

-- Existing installations already have runtime roles. Fresh installations grant
-- execution in runtime-roles.sql after those roles are created.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pixinium_runtime') THEN
    GRANT EXECUTE ON FUNCTION catalog.public_collect_count(bigint) TO pixinium_runtime;
  END IF;
END $$;
