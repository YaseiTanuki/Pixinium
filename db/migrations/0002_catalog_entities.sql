-- Additive migration: the current archive remains readable during rollout.
-- Run in Neon, never in Supabase. catalog is not a browser-facing Data API schema.
CREATE SCHEMA catalog;
REVOKE ALL ON SCHEMA catalog FROM PUBLIC;

CREATE FUNCTION catalog.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION catalog.touch_updated_at() FROM PUBLIC;

CREATE TABLE catalog.categories (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  description text NOT NULL DEFAULT '',
  icon_key text NOT NULL DEFAULT 'grid',
  accent_color text NOT NULL DEFAULT '#e94343' CHECK (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  artwork_style text NOT NULL DEFAULT 'image' CHECK (artwork_style IN ('image', 'record')),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE catalog.items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category_id bigint NOT NULL REFERENCES catalog.categories(id) ON DELETE RESTRICT,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  summary text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at timestamptz,
  accent_color text NOT NULL DEFAULT '#f1e5dd' CHECK (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  is_featured boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'published' OR published_at IS NOT NULL)
);
CREATE INDEX items_category_idx ON catalog.items(category_id);
CREATE INDEX items_published_order_idx ON catalog.items(sort_order, id) WHERE status = 'published';
CREATE INDEX items_category_published_idx ON catalog.items(category_id, sort_order, id) WHERE status = 'published';

-- Display facts are ordered, category-independent data, not a parsed meta string.
-- Metadata is for optional machine-readable extensions, not relationships or permissions.
CREATE TABLE catalog.item_facts (
  item_id bigint NOT NULL REFERENCES catalog.items(id) ON DELETE CASCADE,
  key text NOT NULL CHECK (key ~ '^[a-z][a-z0-9_]*$'),
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  value text NOT NULL CHECK (length(btrim(value)) > 0),
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (item_id, key)
);

CREATE TABLE catalog.assets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider text NOT NULL CHECK (provider IN ('external', 'supabase')),
  external_url text CHECK (external_url ~ '^https://[^/[:space:]]+'),
  bucket text CHECK (length(btrim(bucket)) > 0),
  object_path text CHECK (length(btrim(object_path)) > 0),
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'audio', 'video', 'file')),
  mime_type text,
  byte_size bigint CHECK (byte_size >= 0),
  width integer CHECK (width > 0),
  height integer CHECK (height > 0),
  duration_seconds numeric(12,3) CHECK (duration_seconds >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (provider = 'external' AND external_url IS NOT NULL AND bucket IS NULL AND object_path IS NULL)
    OR (provider = 'supabase' AND external_url IS NULL AND bucket IS NOT NULL AND object_path IS NOT NULL)
  )
);
CREATE UNIQUE INDEX assets_external_url_idx ON catalog.assets(external_url) WHERE provider = 'external';
CREATE UNIQUE INDEX assets_storage_path_idx ON catalog.assets(bucket, object_path) WHERE provider = 'supabase';

CREATE TABLE catalog.item_assets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id bigint NOT NULL REFERENCES catalog.items(id) ON DELETE CASCADE,
  asset_id bigint NOT NULL REFERENCES catalog.assets(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN ('cover', 'gallery', 'preview', 'download')),
  alt_text text NOT NULL DEFAULT '',
  focal_x numeric(5,2) NOT NULL DEFAULT 50 CHECK (focal_x BETWEEN 0 AND 100),
  focal_y numeric(5,2) NOT NULL DEFAULT 50 CHECK (focal_y BETWEEN 0 AND 100),
  sort_order integer NOT NULL DEFAULT 0,
  UNIQUE (item_id, asset_id, role)
);
CREATE UNIQUE INDEX item_assets_cover_idx ON catalog.item_assets(item_id) WHERE role = 'cover';
CREATE INDEX item_assets_asset_idx ON catalog.item_assets(asset_id);

CREATE TABLE catalog.tags (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text NOT NULL CHECK (length(btrim(name)) > 0)
);
CREATE TABLE catalog.item_tags (
  item_id bigint NOT NULL REFERENCES catalog.items(id) ON DELETE CASCADE,
  tag_id bigint NOT NULL REFERENCES catalog.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, tag_id)
);
CREATE INDEX item_tags_tag_idx ON catalog.item_tags(tag_id, item_id);

CREATE TABLE catalog.collections (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- Logical reference to Supabase auth.users.id: no cross-database FK.
  owner_user_id uuid,
  kind text NOT NULL DEFAULT 'custom' CHECK (kind IN ('saved', 'custom', 'editorial')),
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  description text NOT NULL DEFAULT '',
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'editorial' AND owner_user_id IS NULL) OR (kind <> 'editorial' AND owner_user_id IS NOT NULL)),
  CHECK (kind <> 'saved' OR NOT is_public),
  UNIQUE (owner_user_id, slug)
);
CREATE UNIQUE INDEX collections_saved_owner_idx ON catalog.collections(owner_user_id) WHERE kind = 'saved';
CREATE UNIQUE INDEX collections_editorial_slug_idx ON catalog.collections(slug) WHERE kind = 'editorial';
CREATE TABLE catalog.collection_items (
  collection_id bigint NOT NULL REFERENCES catalog.collections(id) ON DELETE CASCADE,
  item_id bigint NOT NULL REFERENCES catalog.items(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, item_id)
);
CREATE INDEX collection_items_item_idx ON catalog.collection_items(item_id);
CREATE INDEX collection_items_order_idx ON catalog.collection_items(collection_id, sort_order, item_id);

-- Keep old title-based URLs and localStorage saves resolvable after a rename.
CREATE TABLE catalog.legacy_item_keys (
  legacy_title text PRIMARY KEY,
  item_id bigint NOT NULL UNIQUE REFERENCES catalog.items(id) ON DELETE CASCADE
);

INSERT INTO catalog.categories (slug, name, description, icon_key, artwork_style, sort_order) VALUES
  ('wallpapers', 'Wallpapers', 'A new view for your everyday.', 'image', 'image', 0),
  ('music', 'Music', 'Find your next on-repeat.', 'music', 'record', 1),
  ('games', 'Games', 'A small escape. A new adventure.', 'gamepad', 'image', 2);

-- Use a temporary map: stable IDs survive title edits; ID suffixes avoid slug collisions.
CREATE TEMP TABLE catalog_backfill ON COMMIT DROP AS
SELECT a.*, c.id AS category_id, row_number() OVER (ORDER BY a.sort_order, a.title) AS migration_order
FROM public.archive_items a JOIN catalog.categories c ON c.name = a.category;

INSERT INTO catalog.items (category_id, slug, title, summary, status, published_at, accent_color, sort_order, metadata)
SELECT category_id,
  coalesce(nullif(trim(both '-' FROM regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g')), ''), 'item') || '-' || migration_order,
  title, meta, 'published', now(),
  coalesce(substring(color FROM '#[0-9a-fA-F]{6}'), '#f1e5dd'), sort_order,
  jsonb_build_object('legacy', jsonb_build_object('meta', meta, 'color', color, 'crop', crop, 'accent', accent))
FROM catalog_backfill ORDER BY migration_order;

INSERT INTO catalog.legacy_item_keys (legacy_title, item_id)
SELECT b.title, i.id FROM catalog_backfill b JOIN catalog.items i ON i.title = b.title;

INSERT INTO catalog.item_facts (item_id, key, label, value, sort_order)
SELECT k.item_id,
  CASE WHEN f.ordinality = 1 THEN CASE b.category WHEN 'Wallpapers' THEN 'resolution' WHEN 'Music' THEN 'tracks' ELSE 'size' END
       WHEN f.ordinality = 2 THEN CASE b.category WHEN 'Wallpapers' THEN 'collection' WHEN 'Music' THEN 'duration' ELSE 'platform' END
       ELSE 'detail_' || f.ordinality END,
  CASE WHEN f.ordinality = 1 THEN CASE b.category WHEN 'Wallpapers' THEN 'Resolution' WHEN 'Music' THEN 'Tracks' ELSE 'Size' END
       WHEN f.ordinality = 2 THEN CASE b.category WHEN 'Wallpapers' THEN 'Collection' WHEN 'Music' THEN 'Running time' ELSE 'Platform' END
       ELSE 'Details' END,
  btrim(f.value), (f.ordinality - 1)::integer
FROM catalog_backfill b JOIN catalog.legacy_item_keys k ON k.legacy_title = b.title
CROSS JOIN LATERAL unnest(string_to_array(b.meta, '·')) WITH ORDINALITY AS f(value, ordinality)
WHERE length(btrim(f.value)) > 0;

INSERT INTO catalog.assets (provider, external_url)
SELECT DISTINCT 'external', image FROM catalog_backfill WHERE image IS NOT NULL;
INSERT INTO catalog.item_assets (item_id, asset_id, role, alt_text, focal_x, focal_y)
SELECT k.item_id, a.id, 'cover', b.title,
  coalesce((regexp_match(b.crop, 'object-\[([0-9]+)%_([0-9]+)%\]'))[1]::numeric, 50),
  coalesce((regexp_match(b.crop, 'object-\[([0-9]+)%_([0-9]+)%\]'))[2]::numeric, 50)
FROM catalog_backfill b JOIN catalog.legacy_item_keys k ON k.legacy_title = b.title
JOIN catalog.assets a ON a.external_url = b.image;

CREATE TRIGGER categories_updated BEFORE UPDATE ON catalog.categories FOR EACH ROW EXECUTE FUNCTION catalog.touch_updated_at();
CREATE TRIGGER items_updated BEFORE UPDATE ON catalog.items FOR EACH ROW EXECUTE FUNCTION catalog.touch_updated_at();
CREATE TRIGGER assets_updated BEFORE UPDATE ON catalog.assets FOR EACH ROW EXECUTE FUNCTION catalog.touch_updated_at();
CREATE TRIGGER collections_updated BEFORE UPDATE ON catalog.collections FOR EACH ROW EXECUTE FUNCTION catalog.touch_updated_at();

-- Runtime roles must be non-owner, NOSUPERUSER, NOBYPASSRLS. No access is granted here.
-- app.user_id is set transaction-locally by the server AFTER verifying Supabase identity.
ALTER TABLE catalog.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY categories_read ON catalog.categories FOR SELECT USING (is_active);
ALTER TABLE catalog.items ENABLE ROW LEVEL SECURITY;
CREATE POLICY items_read ON catalog.items FOR SELECT USING (
  status = 'published' AND EXISTS (SELECT 1 FROM catalog.categories c WHERE c.id = category_id)
);
ALTER TABLE catalog.item_facts ENABLE ROW LEVEL SECURITY;
CREATE POLICY facts_read ON catalog.item_facts FOR SELECT USING (EXISTS (SELECT 1 FROM catalog.items i WHERE i.id = item_id));
ALTER TABLE catalog.item_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY item_assets_read ON catalog.item_assets FOR SELECT USING (EXISTS (SELECT 1 FROM catalog.items i WHERE i.id = item_id));
ALTER TABLE catalog.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY assets_read ON catalog.assets FOR SELECT USING (EXISTS (SELECT 1 FROM catalog.item_assets ia WHERE ia.asset_id = catalog.assets.id));
ALTER TABLE catalog.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY tags_read ON catalog.tags FOR SELECT USING (true);
ALTER TABLE catalog.item_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY item_tags_read ON catalog.item_tags FOR SELECT USING (EXISTS (SELECT 1 FROM catalog.items i WHERE i.id = item_id));
ALTER TABLE catalog.legacy_item_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY legacy_keys_read ON catalog.legacy_item_keys FOR SELECT USING (EXISTS (SELECT 1 FROM catalog.items i WHERE i.id = item_id));

ALTER TABLE catalog.collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY collections_read ON catalog.collections FOR SELECT USING (
  is_public OR owner_user_id = nullif(current_setting('app.user_id', true), '')::uuid
);
CREATE POLICY collections_insert ON catalog.collections FOR INSERT WITH CHECK (
  kind <> 'editorial' AND owner_user_id = nullif(current_setting('app.user_id', true), '')::uuid
);
CREATE POLICY collections_update ON catalog.collections FOR UPDATE USING (
  owner_user_id = nullif(current_setting('app.user_id', true), '')::uuid
) WITH CHECK (kind <> 'editorial' AND owner_user_id = nullif(current_setting('app.user_id', true), '')::uuid);
CREATE POLICY collections_delete ON catalog.collections FOR DELETE USING (
  owner_user_id = nullif(current_setting('app.user_id', true), '')::uuid
);
ALTER TABLE catalog.collection_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY collection_items_read ON catalog.collection_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM catalog.collections c WHERE c.id = collection_id)
  AND EXISTS (SELECT 1 FROM catalog.items i WHERE i.id = item_id)
);
CREATE POLICY collection_items_insert ON catalog.collection_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM catalog.collections c WHERE c.id = collection_id AND c.owner_user_id = nullif(current_setting('app.user_id', true), '')::uuid)
  AND EXISTS (SELECT 1 FROM catalog.items i WHERE i.id = item_id)
);
CREATE POLICY collection_items_update ON catalog.collection_items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM catalog.collections c WHERE c.id = collection_id AND c.owner_user_id = nullif(current_setting('app.user_id', true), '')::uuid)
) WITH CHECK (
  EXISTS (SELECT 1 FROM catalog.collections c WHERE c.id = collection_id AND c.owner_user_id = nullif(current_setting('app.user_id', true), '')::uuid)
  AND EXISTS (SELECT 1 FROM catalog.items i WHERE i.id = item_id)
);
CREATE POLICY collection_items_delete ON catalog.collection_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM catalog.collections c WHERE c.id = collection_id AND c.owner_user_id = nullif(current_setting('app.user_id', true), '')::uuid)
);
REVOKE ALL ON ALL TABLES IN SCHEMA catalog FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA catalog FROM PUBLIC;
