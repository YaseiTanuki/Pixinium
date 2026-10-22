-- Preserve migration history; do not edit 0002 after it has been applied.
ALTER TABLE catalog.items DROP CONSTRAINT items_slug_key;
ALTER TABLE catalog.items ADD CONSTRAINT items_category_slug_key UNIQUE (category_id, slug);
-- The composite unique index already serves category_id foreign-key lookups.
DROP INDEX catalog.items_category_idx;

ALTER TABLE catalog.categories ADD COLUMN metadata_schema_key text NOT NULL DEFAULT 'generic.v1'
  CHECK (metadata_schema_key ~ '^[a-z][a-z0-9_-]*\.v[1-9][0-9]*$');
UPDATE catalog.categories SET metadata_schema_key = slug || '.v1'
WHERE slug IN ('wallpapers', 'music', 'games');

ALTER TABLE catalog.assets DROP CONSTRAINT assets_provider_check;
ALTER TABLE catalog.assets DROP CONSTRAINT assets_check;
ALTER TABLE catalog.assets ADD CONSTRAINT assets_provider_check CHECK (provider IN ('external', 'supabase', 'r2'));
ALTER TABLE catalog.assets ADD CONSTRAINT assets_location_check CHECK (
  (provider = 'external' AND external_url IS NOT NULL AND bucket IS NULL AND object_path IS NULL)
  OR (provider IN ('supabase', 'r2') AND external_url IS NULL AND bucket IS NOT NULL AND object_path IS NOT NULL)
);
DROP INDEX catalog.assets_storage_path_idx;
CREATE UNIQUE INDEX assets_storage_path_idx ON catalog.assets(provider, bucket, object_path)
WHERE provider IN ('supabase', 'r2');

CREATE TABLE catalog.profiles (
  -- Supabase owns authentication; this UUID has no local default or auth.users FK.
  id uuid PRIMARY KEY,
  username text UNIQUE CHECK (username ~ '^[a-z0-9_]{3,32}$'),
  display_name text NOT NULL DEFAULT '' CHECK (char_length(display_name) <= 100),
  avatar_url text CHECK (avatar_url ~ '^https://[^/[:space:]]+'),
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'editor', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Preserve any existing collection owners without inventing usernames or auth accounts.
INSERT INTO catalog.profiles(id) SELECT DISTINCT owner_user_id FROM catalog.collections WHERE owner_user_id IS NOT NULL;
ALTER TABLE catalog.collections ADD CONSTRAINT collections_owner_profile_fkey
  FOREIGN KEY (owner_user_id) REFERENCES catalog.profiles(id) ON DELETE CASCADE;
-- collections(owner_user_id, slug) already indexes this new FK.

CREATE FUNCTION catalog.protect_profile_identity() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Profile identity cannot be changed' USING ERRCODE = '23514';
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT pg_has_role(
    current_user, (SELECT relowner FROM pg_class WHERE oid = 'catalog.profiles'::regclass), 'USAGE'
  ) THEN
    RAISE EXCEPTION 'Only trusted profile administrators can change roles' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION catalog.protect_profile_identity() FROM PUBLIC;
CREATE TRIGGER profiles_protect_identity BEFORE UPDATE ON catalog.profiles
  FOR EACH ROW EXECUTE FUNCTION catalog.protect_profile_identity();
CREATE TRIGGER profiles_updated BEFORE UPDATE ON catalog.profiles
  FOR EACH ROW EXECUTE FUNCTION catalog.touch_updated_at();
ALTER TABLE catalog.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_read ON catalog.profiles FOR SELECT USING (
  id = nullif(current_setting('app.user_id', true), '')::uuid
);
CREATE POLICY profiles_insert ON catalog.profiles FOR INSERT WITH CHECK (
  id = nullif(current_setting('app.user_id', true), '')::uuid AND role = 'member'
);
CREATE POLICY profiles_update ON catalog.profiles FOR UPDATE USING (
  id = nullif(current_setting('app.user_id', true), '')::uuid
) WITH CHECK (id = nullif(current_setting('app.user_id', true), '')::uuid);
REVOKE ALL ON catalog.profiles FROM PUBLIC;

-- Join tables already have primary/unique keys and foreign keys in 0002.
-- Complete ordered read indexes and reject invalid ordering values.
ALTER TABLE catalog.categories ADD CONSTRAINT categories_order_check CHECK (sort_order >= 0);
ALTER TABLE catalog.items ADD CONSTRAINT items_order_check CHECK (sort_order >= 0);
ALTER TABLE catalog.item_facts ADD CONSTRAINT item_facts_order_check CHECK (sort_order >= 0);
ALTER TABLE catalog.item_assets ADD CONSTRAINT item_assets_order_check CHECK (sort_order >= 0);
ALTER TABLE catalog.collection_items ADD CONSTRAINT collection_items_order_check CHECK (sort_order >= 0);
CREATE INDEX item_facts_order_idx ON catalog.item_facts(item_id, sort_order, key);
CREATE INDEX item_assets_order_idx ON catalog.item_assets(item_id, role, sort_order, id);
-- collections_saved_owner_idx from 0002 enforces one saved collection per owner.
