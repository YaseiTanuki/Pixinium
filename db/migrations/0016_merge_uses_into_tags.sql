-- Preserve every use and item relationship as a tag before removing the old model.
-- The migration runner wraps this file and its ledger entry in one transaction.
SET LOCAL lock_timeout = '10s';
LOCK TABLE catalog.content_uses, catalog.item_uses IN ACCESS EXCLUSIVE MODE;

INSERT INTO catalog.tags(slug, name)
SELECT slug, name FROM catalog.content_uses
ON CONFLICT (slug) DO NOTHING;

INSERT INTO catalog.item_tags(item_id, tag_id)
SELECT iu.item_id, t.id
FROM catalog.item_uses iu JOIN catalog.tags t ON t.slug = iu.use_slug
ON CONFLICT (item_id, tag_id) DO NOTHING;

-- Fail and roll back if any association was not copied, including archived items.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM catalog.item_uses iu
    LEFT JOIN catalog.tags t ON t.slug = iu.use_slug
    LEFT JOIN catalog.item_tags it ON it.item_id = iu.item_id AND it.tag_id = t.id
    WHERE it.item_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Some content uses were not migrated to tags';
  END IF;
END
$$;

DROP TABLE catalog.item_uses;
DROP TABLE catalog.content_uses;
