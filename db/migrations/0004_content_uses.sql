-- Uses describe what a find is suitable for; category still owns its canonical URL.
CREATE TABLE catalog.content_uses (
  slug text PRIMARY KEY CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  sort_order integer NOT NULL DEFAULT 0
);
CREATE TABLE catalog.item_uses (
  item_id bigint NOT NULL REFERENCES catalog.items(id) ON DELETE CASCADE,
  use_slug text NOT NULL REFERENCES catalog.content_uses(slug) ON DELETE RESTRICT,
  PRIMARY KEY (item_id, use_slug)
);
CREATE INDEX item_uses_use_idx ON catalog.item_uses(use_slug, item_id);

INSERT INTO catalog.content_uses(slug, name, sort_order) VALUES
  ('wallpaper', 'Wallpaper', 0), ('background', 'Background', 1), ('avatar', 'Avatar', 2);
INSERT INTO catalog.item_uses(item_id, use_slug)
SELECT i.id, 'wallpaper' FROM catalog.items i JOIN catalog.categories c ON c.id = i.category_id
WHERE c.slug = 'wallpapers';

ALTER TABLE catalog.content_uses ENABLE ROW LEVEL SECURITY;
CREATE POLICY content_uses_read ON catalog.content_uses FOR SELECT USING (true);
ALTER TABLE catalog.item_uses ENABLE ROW LEVEL SECURITY;
CREATE POLICY item_uses_read ON catalog.item_uses FOR SELECT USING (
  EXISTS (SELECT 1 FROM catalog.items i JOIN catalog.categories c ON c.id = i.category_id
    WHERE i.id = item_id AND i.status = 'published' AND c.is_active)
);
REVOKE ALL ON catalog.content_uses, catalog.item_uses FROM PUBLIC;
-- Apply SELECT grants to the deployment's runtime role before rolling out app code.
