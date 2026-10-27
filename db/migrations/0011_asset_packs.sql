-- Asset packs have a separate cover, display previews, and one generated ZIP download.
ALTER TABLE catalog.item_assets DROP CONSTRAINT item_assets_role_check;
ALTER TABLE catalog.item_assets ADD CONSTRAINT item_assets_role_check
  CHECK (role IN ('cover', 'download', 'preview'));

INSERT INTO catalog.categories(slug, name, description, icon_key, metadata_schema_key, sort_order)
VALUES ('assets', 'Assets', 'Image packs for your next project.', 'grid', 'assets.v1', 40)
ON CONFLICT (slug) DO UPDATE SET metadata_schema_key = EXCLUDED.metadata_schema_key;

INSERT INTO catalog.content_uses(slug, name, sort_order)
VALUES ('assets', 'Assets', 40)
ON CONFLICT (slug) DO NOTHING;
