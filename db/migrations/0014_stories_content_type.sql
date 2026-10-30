INSERT INTO catalog.categories(slug, name, description, icon_key, metadata_schema_key, sort_order)
VALUES ('stories', 'Stories', 'A little place for stories worth getting lost in.', 'book', 'stories.v1', 50)
ON CONFLICT (slug) DO UPDATE SET metadata_schema_key = EXCLUDED.metadata_schema_key;

INSERT INTO catalog.content_uses(slug, name, sort_order)
VALUES ('stories', 'Stories', 50)
ON CONFLICT (slug) DO NOTHING;
