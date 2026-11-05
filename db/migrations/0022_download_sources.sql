-- Source definitions and priority are managed centrally, separate from item links.
CREATE TABLE catalog.download_sources (
  slug text PRIMARY KEY CHECK (slug ~ '^[a-z][a-z0-9_]{0,59}$'),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  kind text NOT NULL CHECK (kind IN ('internal', 'external')),
  hostname text CHECK (length(hostname) <= 253 AND hostname ~ '^[a-z0-9]+([.-][a-z0-9]+)*\.[a-z]{2,}$'),
  priority integer NOT NULL CHECK (priority BETWEEN 0 AND 9999),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((slug = 'pixinium' AND kind = 'internal' AND hostname IS NULL)
    OR (slug <> 'pixinium' AND kind = 'external' AND hostname IS NOT NULL))
);
INSERT INTO catalog.download_sources(slug,name,kind,hostname,priority) VALUES
  ('github','GitHub','external','github.com',1),
  ('internet_archive','Internet Archive','external','archive.org',2),
  ('pixinium','Pixinium','internal',NULL,3);
CREATE TABLE catalog.item_download_sources (
  item_id bigint NOT NULL REFERENCES catalog.items(id) ON DELETE CASCADE,
  source_slug text NOT NULL REFERENCES catalog.download_sources(slug) ON DELETE RESTRICT,
  url text NOT NULL CHECK (length(url) BETWEEN 1 AND 2048 AND url ~ '^https://[^[:space:]]+$'),
  PRIMARY KEY(item_id,source_slug)
);
CREATE INDEX item_download_sources_source_idx ON catalog.item_download_sources(source_slug,item_id);
CREATE TRIGGER download_sources_updated BEFORE UPDATE ON catalog.download_sources
  FOR EACH ROW EXECUTE FUNCTION catalog.touch_updated_at();

-- Lock the registry row while validating so domain edits/disablement cannot race publication.
CREATE FUNCTION catalog.validate_download_link() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE source catalog.download_sources;
BEGIN
  SELECT * INTO source FROM catalog.download_sources WHERE slug=NEW.source_slug FOR SHARE;
  IF NOT FOUND OR source.kind <> 'external' OR lower(substring(NEW.url from '^https://([^/?#]+)')) <> source.hostname
    OR NEW.url !~ '^https://' OR NEW.url ~ '[[:space:]]' THEN
    RAISE EXCEPTION 'Download URL must use HTTPS and the configured source domain' USING ERRCODE='23514';
  END IF;
  IF NOT source.is_active AND NOT EXISTS (SELECT 1 FROM catalog.item_download_sources
    WHERE item_id=NEW.item_id AND source_slug=NEW.source_slug AND url=NEW.url) THEN
    RAISE EXCEPTION 'Download source is disabled' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION catalog.validate_download_link() FROM PUBLIC;
CREATE TRIGGER item_download_sources_validate BEFORE INSERT OR UPDATE ON catalog.item_download_sources
  FOR EACH ROW EXECUTE FUNCTION catalog.validate_download_link();

CREATE FUNCTION catalog.protect_download_source() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.kind='internal' THEN RAISE EXCEPTION 'Pixinium cannot be deleted' USING ERRCODE='23514'; END IF;
    RETURN OLD;
  END IF;
  IF NEW.slug IS DISTINCT FROM OLD.slug OR NEW.kind IS DISTINCT FROM OLD.kind THEN
    RAISE EXCEPTION 'Source identity cannot be changed' USING ERRCODE='23514';
  END IF;
  IF NEW.hostname IS DISTINCT FROM OLD.hostname AND EXISTS (
    SELECT 1 FROM catalog.item_download_sources WHERE source_slug=OLD.slug
  ) THEN RAISE EXCEPTION 'Domain cannot change while items use this source' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION catalog.protect_download_source() FROM PUBLIC;
CREATE TRIGGER download_sources_protect BEFORE UPDATE OR DELETE ON catalog.download_sources
  FOR EACH ROW EXECUTE FUNCTION catalog.protect_download_source();

-- Move every previously stored link; invalid/unrecognised links stop the migration.
INSERT INTO catalog.item_download_sources(item_id,source_slug,url)
SELECT i.id,s->>'provider',s->>'url' FROM catalog.items i
CROSS JOIN LATERAL jsonb_array_elements(coalesce(i.metadata->'download_sources','[]'::jsonb)) s;
UPDATE catalog.items SET metadata=metadata-'download_sources' WHERE metadata ? 'download_sources';

ALTER TABLE catalog.download_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog.item_download_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY download_sources_read ON catalog.download_sources FOR SELECT USING (is_active);
CREATE POLICY item_download_sources_read ON catalog.item_download_sources FOR SELECT USING (
  EXISTS (SELECT 1 FROM catalog.items i JOIN catalog.categories c ON c.id=i.category_id
    WHERE i.id=item_id AND i.status='published' AND c.is_active)
  AND EXISTS (SELECT 1 FROM catalog.download_sources s WHERE s.slug=source_slug AND s.is_active)
);
REVOKE ALL ON catalog.download_sources,catalog.item_download_sources FROM PUBLIC;
-- Preserve explicit read roles already authorised for public catalog items.
DO $$ DECLARE reader record; BEGIN
  FOR reader IN SELECT DISTINCT grantee FROM information_schema.role_table_grants
    WHERE table_schema='catalog' AND table_name='items' AND privilege_type='SELECT'
      AND grantee NOT IN ('PUBLIC','pixinium_agent','pixinium_agent_api')
  LOOP EXECUTE format('GRANT SELECT ON catalog.download_sources,catalog.item_download_sources TO %I',reader.grantee); END LOOP;
END $$;

-- Keep the existing machine broker signatures and grants.
CREATE OR REPLACE FUNCTION automation.publish_job(k uuid,h text,job uuid,lease uuid,schema_key text,doc jsonb,bucket_name text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,automation,pg_temp AS $$
DECLARE a automation.agents; j automation.jobs; category_slug text; outcome jsonb; prefix text;
BEGIN
  a:=automation.check_key(k,h,'content:create');
  SELECT * INTO j FROM automation.jobs WHERE id=job AND agent_id=a.id AND state='processing' AND lease_token=lease AND lease_until>clock_timestamp() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job lease expired' USING ERRCODE='P0409'; END IF;
  PERFORM automation.check_key(k,h,'content:publish',j.category_id);
  SELECT slug INTO category_slug FROM catalog.categories WHERE id=j.category_id AND metadata_schema_key=schema_key AND is_active FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Category changed' USING ERRCODE='P0403'; END IF;
  prefix:='agents/'||a.id::text||'/items/'||j.reserved_item_id::text||'/'||lease::text||'/';
  IF jsonb_typeof(doc->'attachments') IS DISTINCT FROM 'array' OR jsonb_array_length(doc->'attachments') NOT BETWEEN 1 AND 56 OR
    EXISTS(SELECT 1 FROM jsonb_array_elements(doc->'attachments') f WHERE f->>'path' IS NULL OR f->>'path' NOT LIKE prefix||'%' OR f->>'path' LIKE '%..%' OR position(chr(92) IN (f->>'path'))>0) THEN
    RAISE EXCEPTION 'Invalid finalized file location' USING ERRCODE='P0403';
  END IF;
  INSERT INTO catalog.items(id,category_id,slug,title,summary,description,status,published_at,accent_color,is_featured,sort_order,metadata)
    OVERRIDING SYSTEM VALUE VALUES(j.reserved_item_id,j.category_id,doc->>'slug',doc->>'title',doc->>'summary',coalesce(nullif(doc->>'description',doc->>'summary'),''),'draft',NULL,doc->>'accentColor',false,0,doc->'metadata');
  INSERT INTO catalog.item_facts(item_id,key,label,value,sort_order)
    SELECT j.reserved_item_id,f->>'key',f->>'label',f->>'value',(ord-1)::integer FROM jsonb_array_elements(doc->'facts') WITH ORDINALITY x(f,ord);
  WITH tags AS(INSERT INTO catalog.tags(slug,name) SELECT t->>'slug',t->>'name' FROM jsonb_array_elements(doc->'tags') t ON CONFLICT(slug) DO UPDATE SET slug=EXCLUDED.slug RETURNING id)
    INSERT INTO catalog.item_tags(item_id,tag_id) SELECT j.reserved_item_id,id FROM tags;
  WITH assets AS(INSERT INTO catalog.assets(provider,bucket,object_path,media_type,mime_type,byte_size,width,height,duration_seconds)
    SELECT 's3',bucket_name,f->>'path',f->>'mediaType',f->>'mime',(f->>'byteSize')::bigint,(f->>'width')::integer,(f->>'height')::integer,(f->>'durationSeconds')::numeric FROM jsonb_array_elements(doc->'attachments') f RETURNING id,object_path)
    INSERT INTO catalog.item_assets(item_id,asset_id,role,alt_text,focal_x,focal_y,sort_order)
    SELECT j.reserved_item_id,assets.id,f->>'role',f->>'altText',(f->>'focalX')::numeric,(f->>'focalY')::numeric,(ord-1)::integer
    FROM jsonb_array_elements(doc->'attachments') WITH ORDINALITY x(f,ord) JOIN assets ON assets.object_path=f->>'path';
  INSERT INTO catalog.item_download_sources(item_id,source_slug,url)
    SELECT j.reserved_item_id,s->>'provider',s->>'url' FROM jsonb_array_elements(coalesce(doc->'downloadSources','[]'::jsonb)) s;
  outcome:=jsonb_build_object('id',j.reserved_item_id::text,'slug',doc->>'slug','category',category_slug,'status','draft','message','Content saved as a draft for admin review.');
  INSERT INTO automation.item_origins(item_id,agent_id,key_id,job_id) VALUES(j.reserved_item_id,a.id,k,job);
  UPDATE automation.jobs SET state='succeeded',result=outcome,updated_at=now() WHERE id=job;
  INSERT INTO automation.audit_events(agent_id,key_id,job_id,action,item_id) VALUES(a.id,k,job,'content_submitted',j.reserved_item_id);
  RETURN outcome;
END $$;


CREATE OR REPLACE FUNCTION automation.catalog(k uuid,h text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,automation,pg_temp AS $$
DECLARE a automation.agents;
BEGIN
  a:=automation.check_key(k,h,'catalog:read');
  RETURN jsonb_build_object('downloadSources',coalesce((SELECT jsonb_agg(jsonb_build_object('slug',slug,'name',name,'kind',kind,'hostname',hostname,'priority',priority,'isActive',is_active) ORDER BY priority,slug) FROM catalog.download_sources WHERE is_active),'[]'::jsonb),'categories',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id::text,'slug',slug,'name',name,'metadataSchemaKey',metadata_schema_key) ORDER BY sort_order,id) FROM catalog.categories WHERE is_active AND id=ANY(a.allowed_categories)),'[]'::jsonb),
    'tags',coalesce((SELECT jsonb_agg(jsonb_build_object('slug',slug,'name',name) ORDER BY name) FROM catalog.tags),'[]'::jsonb));
END $$;
