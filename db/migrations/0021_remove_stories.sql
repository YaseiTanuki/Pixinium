-- Retire the removed content type. Run in the migration transaction after backup.
-- Do not use CASCADE for DDL: unexpected schema dependencies must stop rollout.
CREATE TEMP TABLE retired_story_categories ON COMMIT DROP AS
  SELECT id FROM catalog.categories WHERE slug = 'stories' OR metadata_schema_key = 'stories.v1';
CREATE TEMP TABLE retired_story_items ON COMMIT DROP AS
  SELECT id FROM catalog.items WHERE category_id IN (SELECT id FROM retired_story_categories);
CREATE TEMP TABLE retired_story_assets ON COMMIT DROP AS
  SELECT DISTINCT asset_id AS id FROM catalog.item_assets WHERE item_id IN (SELECT id FROM retired_story_items);

-- Preserve job/audit history rather than silently deleting historical receipts.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM automation.jobs WHERE category_id IN (SELECT id FROM retired_story_categories)) THEN
    RAISE EXCEPTION 'Stories has agent job history; review and migrate these receipts before retirement';
  END IF;
END $$;

DROP TABLE IF EXISTS catalog.story_chapters;
DELETE FROM catalog.items WHERE id IN (SELECT id FROM retired_story_items);
-- Facts, tags, Saved/editorial links and provenance follow their item FKs.
-- Keep assets shared by any surviving content item.
DELETE FROM catalog.assets a WHERE a.id IN (SELECT id FROM retired_story_assets)
  AND NOT EXISTS (SELECT 1 FROM catalog.item_assets ia WHERE ia.asset_id = a.id);

-- Remove retired category IDs without granting any new categories to an agent.
-- An identity left with no categories is disabled, and cannot be reactivated empty.
ALTER TABLE automation.agents DROP CONSTRAINT agents_allowed_categories_check;
ALTER TABLE automation.agents ADD CONSTRAINT agents_allowed_categories_check
  CHECK (cardinality(allowed_categories) <= 100 AND (cardinality(allowed_categories) >= 1 OR NOT active));
UPDATE automation.agents a SET
  allowed_categories = ARRAY(SELECT id FROM unnest(a.allowed_categories) AS ids(id)
    WHERE id NOT IN (SELECT id FROM retired_story_categories)),
  active = a.active AND EXISTS (SELECT 1 FROM unnest(a.allowed_categories) AS ids(id)
    WHERE id NOT IN (SELECT id FROM retired_story_categories))
WHERE a.allowed_categories && ARRAY(SELECT id FROM retired_story_categories);

DELETE FROM catalog.categories WHERE id IN (SELECT id FROM retired_story_categories);
DELETE FROM catalog.tags t WHERE t.slug = 'stories'
  AND NOT EXISTS (SELECT 1 FROM catalog.item_tags it WHERE it.tag_id = t.id);

-- Replace the retired slug exclusions; authorization still checks the actual
-- category, its active state, the current key, scope and explicit allowlist.
CREATE OR REPLACE FUNCTION automation.check_key(k uuid,h text,required_scope text,category bigint DEFAULT NULL)
RETURNS automation.agents LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,automation,pg_temp AS $$
DECLARE principal automation.agents;
BEGIN
  SELECT a.* INTO principal FROM automation.agents a JOIN automation.api_keys x ON x.agent_id=a.id
    WHERE x.id=k AND x.secret_hash=h AND x.revoked_at IS NULL AND x.expires_at>clock_timestamp() AND a.active
    FOR SHARE OF a,x;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid agent credential' USING ERRCODE='P0401'; END IF;
  IF NOT EXISTS(SELECT 1 FROM automation.api_keys WHERE id=k AND required_scope=ANY(scopes)) THEN
    RAISE EXCEPTION 'Agent scope denied' USING ERRCODE='P0403';
  END IF;
  IF category IS NOT NULL AND (NOT category=ANY(principal.allowed_categories) OR NOT EXISTS(SELECT 1 FROM catalog.categories WHERE id=category AND is_active)) THEN
    RAISE EXCEPTION 'Agent category denied' USING ERRCODE='P0403';
  END IF;
  RETURN principal;
END $$;

CREATE OR REPLACE FUNCTION automation.catalog(k uuid,h text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,automation,pg_temp AS $$
DECLARE a automation.agents;
BEGIN
  a:=automation.check_key(k,h,'catalog:read');
  RETURN jsonb_build_object('categories',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id::text,'slug',slug,'name',name,'metadataSchemaKey',metadata_schema_key) ORDER BY sort_order,id) FROM catalog.categories WHERE is_active AND id=ANY(a.allowed_categories)),'[]'::jsonb),
    'tags',coalesce((SELECT jsonb_agg(jsonb_build_object('slug',slug,'name',name) ORDER BY name) FROM catalog.tags),'[]'::jsonb));
END $$;
