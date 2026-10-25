-- Development cleanup: image content type is independent of its intended uses.
UPDATE catalog.categories
SET slug = 'images', name = 'Images', description = 'Images for your screen, space and profile.',
    metadata_schema_key = 'images.v1'
WHERE slug = 'wallpapers';

UPDATE catalog.items SET metadata = metadata - 'legacy' WHERE metadata ? 'legacy';
DROP TABLE catalog.legacy_item_keys;
DROP TABLE public.archive_items;
-- Old /items/wallpapers/... URLs intentionally have no compatibility redirect.
