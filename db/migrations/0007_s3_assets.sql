ALTER TABLE catalog.assets DROP CONSTRAINT assets_provider_check;
ALTER TABLE catalog.assets ADD CONSTRAINT assets_provider_check CHECK (provider IN ('external', 'supabase', 'r2', 's3'));
ALTER TABLE catalog.assets DROP CONSTRAINT assets_location_check;
ALTER TABLE catalog.assets ADD CONSTRAINT assets_location_check CHECK (
  (provider = 'external' AND external_url IS NOT NULL AND bucket IS NULL AND object_path IS NULL)
  OR (provider IN ('supabase', 'r2', 's3') AND external_url IS NULL AND bucket IS NOT NULL AND object_path IS NOT NULL)
);
DROP INDEX catalog.assets_storage_path_idx;
CREATE UNIQUE INDEX assets_storage_path_idx ON catalog.assets(provider, bucket, object_path)
WHERE provider IN ('supabase', 'r2', 's3');
