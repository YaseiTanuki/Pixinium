-- Retire item-only editorial fields. Category/fact/asset ordering is retained.
DROP INDEX catalog.items_published_order_idx;
DROP INDEX catalog.items_category_published_idx;
ALTER TABLE catalog.items DROP COLUMN is_featured, DROP COLUMN sort_order;
CREATE INDEX items_published_order_idx ON catalog.items(published_at DESC NULLS LAST,id DESC)
  WHERE status='published';
CREATE INDEX items_category_published_idx ON catalog.items(category_id,published_at DESC NULLS LAST,id DESC)
  WHERE status='published';

-- Keep the broker signature, credential checks, forced drafts and source links.
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
  INSERT INTO catalog.items(id,category_id,slug,title,summary,description,status,published_at,accent_color,metadata)
    OVERRIDING SYSTEM VALUE VALUES(j.reserved_item_id,j.category_id,doc->>'slug',doc->>'title',doc->>'summary',coalesce(nullif(doc->>'description',doc->>'summary'),''),'draft',NULL,doc->>'accentColor',doc->'metadata');
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
