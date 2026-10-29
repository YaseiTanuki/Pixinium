-- Fields with no active writer/consumer. Keep identity, ownership, visibility,
-- timestamps, and constraints required by the existing collection policies.
ALTER TABLE catalog.categories DROP COLUMN accent_color;
ALTER TABLE catalog.collections DROP COLUMN title, DROP COLUMN description;
ALTER TABLE catalog.collection_items DROP COLUMN sort_order;
ALTER TABLE catalog.profiles DROP COLUMN avatar_url;

-- These display facts are derived from the original asset / pack metadata on read.
DELETE FROM catalog.item_facts f USING catalog.items i, catalog.categories c
WHERE f.item_id = i.id AND i.category_id = c.id AND (
  (c.metadata_schema_key = 'images.v1' AND f.key IN ('resolution', 'format')) OR
  (c.metadata_schema_key = 'assets.v1' AND f.key IN ('quantity', 'format'))
);

-- Preserve any older game metadata as visible facts before retiring its keys.
INSERT INTO catalog.item_facts(item_id, key, label, value, sort_order)
SELECT i.id, 'platform', 'Platforms', (
  SELECT string_agg(p, ', ' ORDER BY ord)
  FROM jsonb_array_elements_text(i.metadata->'platforms') WITH ORDINALITY AS x(p, ord)
), 0
FROM catalog.items i JOIN catalog.categories c ON c.id = i.category_id
WHERE c.metadata_schema_key = 'games.v1'
  AND jsonb_typeof(i.metadata->'platforms') = 'array'
  AND jsonb_array_length(i.metadata->'platforms') > 0
ON CONFLICT (item_id, key) DO NOTHING;
INSERT INTO catalog.item_facts(item_id, key, label, value, sort_order)
SELECT i.id, 'version', 'Version', i.metadata->>'version', 1
FROM catalog.items i JOIN catalog.categories c ON c.id = i.category_id
WHERE c.metadata_schema_key = 'games.v1' AND length(btrim(i.metadata->>'version')) > 0
ON CONFLICT (item_id, key) DO NOTHING;

UPDATE catalog.items i SET metadata = '{}'::jsonb FROM catalog.categories c
WHERE c.id = i.category_id AND c.metadata_schema_key IN ('images.v1', 'games.v1')
  AND i.metadata <> '{}'::jsonb;
-- The detail page already suppresses description when it equals the summary.
UPDATE catalog.items SET description = '' WHERE description = summary AND description <> '';
