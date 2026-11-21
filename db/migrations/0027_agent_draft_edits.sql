-- Agents can edit only their own private drafts. No table grants or public status operation.
ALTER TABLE automation.api_keys DROP CONSTRAINT api_keys_scopes_check;
-- An obsolete publish-only key is revoked rather than becoming an active read key.
UPDATE automation.api_keys SET revoked_at=coalesce(revoked_at,now()),scopes=ARRAY['catalog:read']::text[] WHERE cardinality(array_remove(scopes,'content:publish'))=0;
UPDATE automation.api_keys SET scopes=array_remove(scopes,'content:publish') WHERE 'content:publish'=ANY(scopes);
ALTER TABLE automation.api_keys ADD CONSTRAINT api_keys_scopes_check
  CHECK (cardinality(scopes)>0 AND scopes <@ ARRAY['catalog:read','uploads:write','content:create','content:edit']::text[]);

CREATE TABLE automation.draft_edits (
  agent_id uuid NOT NULL REFERENCES automation.agents(id) ON DELETE RESTRICT,
  request_key text NOT NULL CHECK (length(request_key) BETWEEN 1 AND 128),
  item_id bigint NOT NULL REFERENCES catalog.items(id) ON DELETE CASCADE,
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(agent_id,request_key)
);
CREATE INDEX draft_edits_item_idx ON automation.draft_edits(item_id);
ALTER TABLE automation.draft_edits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON automation.draft_edits FROM PUBLIC,pixinium_agent;

ALTER TABLE automation.audit_events DROP CONSTRAINT audit_events_action_check;
ALTER TABLE automation.audit_events ADD CONSTRAINT audit_events_action_check CHECK (action IN (
  'key_created','key_revoked','agent_disabled','upload_reserved','upload_discarded',
  'job_started','job_retried','job_failed','content_published','content_submitted','draft_updated','key_scopes_updated'
));

CREATE FUNCTION automation.drafts(k uuid,h text,before_id bigint DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,automation,pg_temp AS $$
DECLARE a automation.agents; rows jsonb;
BEGIN
  a:=automation.check_key(k,h,'content:edit');
  SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.id::bigint DESC),'[]'::jsonb) INTO rows FROM (
    SELECT i.id::text,i.title,c.slug AS category,i.updated_at AS "updatedAt"
    FROM catalog.items i JOIN automation.item_origins o ON o.item_id=i.id
    JOIN catalog.categories c ON c.id=i.category_id
    WHERE o.agent_id=a.id AND i.status='draft' AND i.published_at IS NULL AND c.is_active
      AND i.category_id=ANY(a.allowed_categories) AND (before_id IS NULL OR i.id<before_id)
    ORDER BY i.id DESC LIMIT 21
  ) d;
  RETURN jsonb_build_object('drafts',rows - 20,'nextCursor',CASE WHEN jsonb_array_length(rows)>20 THEN rows->19->>'id' ELSE NULL END);
END $$;

CREATE FUNCTION automation.draft(k uuid,h text,target bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,automation,pg_temp AS $$
DECLARE a automation.agents; item catalog.items; schema_key text;
BEGIN
  a:=automation.check_key(k,h,'content:edit');
  SELECT i.* INTO item FROM catalog.items i JOIN automation.item_origins o ON o.item_id=i.id
    WHERE i.id=target AND o.agent_id=a.id AND i.status='draft' AND i.published_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Draft access denied' USING ERRCODE='P0403'; END IF;
  PERFORM automation.check_key(k,h,'content:edit',item.category_id);
  SELECT metadata_schema_key INTO schema_key FROM catalog.categories WHERE id=item.category_id;
  RETURN jsonb_build_object('id',item.id::text,'title',item.title,'summary',item.summary,'description',item.description,
    'status','draft','slug',item.slug,'categoryId',item.category_id::text,'schemaKey',schema_key,'updatedAt',item.updated_at,
    'factsEditable',schema_key<>'images.v1',
    'tags',coalesce((SELECT jsonb_agg(jsonb_build_object('slug',t.slug,'name',t.name) ORDER BY t.slug) FROM catalog.item_tags it JOIN catalog.tags t ON t.id=it.tag_id WHERE it.item_id=target),'[]'::jsonb),
    'facts',coalesce((SELECT jsonb_agg(jsonb_build_object('key',f.key,'label',f.label,'value',f.value) ORDER BY f.sort_order,f.key) FROM catalog.item_facts f WHERE f.item_id=target),'[]'::jsonb),
    'downloadSources',coalesce((SELECT jsonb_agg(jsonb_build_object('provider',source_slug,'url',url) ORDER BY source_slug) FROM catalog.item_download_sources WHERE item_id=target),'[]'::jsonb),
    'files',coalesce((SELECT jsonb_agg(jsonb_build_object('assetId',ia.asset_id::text,'role',ia.role,'altText',ia.alt_text,'mediaType',s.media_type,'mimeType',s.mime_type) ORDER BY ia.sort_order,ia.id) FROM catalog.item_assets ia JOIN catalog.assets s ON s.id=ia.asset_id WHERE ia.item_id=target),'[]'::jsonb));
END $$;

CREATE FUNCTION automation.update_draft(k uuid,h text,target bigint,request_key text,body_hash text,expected_updated_at timestamptz,patch jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,automation,pg_temp AS $$
DECLARE a automation.agents; item catalog.items; receipt automation.draft_edits; outcome jsonb; schema_key text;
BEGIN
  a:=automation.check_key(k,h,'content:edit');
  IF request_key IS NULL OR request_key !~ '^[A-Za-z0-9._:-]{1,128}$' OR body_hash IS NULL OR body_hash !~ '^[a-f0-9]{64}$'
    OR expected_updated_at IS NULL OR jsonb_typeof(patch) IS DISTINCT FROM 'object' OR patch='{}'::jsonb THEN
    RAISE EXCEPTION 'Invalid draft edit' USING ERRCODE='P0422';
  END IF;
  -- Serialize retries, then lock the item against an admin publishing it during this edit.
  PERFORM pg_advisory_xact_lock(hashtextextended(a.id::text||':'||request_key,0));
  SELECT i.* INTO item FROM catalog.items i JOIN automation.item_origins o ON o.item_id=i.id
    WHERE i.id=target AND o.agent_id=a.id AND i.status='draft' AND i.published_at IS NULL FOR UPDATE OF i;
  IF NOT FOUND THEN RAISE EXCEPTION 'Draft access denied' USING ERRCODE='P0403'; END IF;
  PERFORM automation.check_key(k,h,'content:edit',item.category_id);
  SELECT * INTO receipt FROM automation.draft_edits e WHERE e.agent_id=a.id AND e.request_key=update_draft.request_key;
  IF FOUND THEN
    IF receipt.item_id<>target OR receipt.payload_hash<>body_hash THEN RAISE EXCEPTION 'Idempotency conflict' USING ERRCODE='P0409'; END IF;
    RETURN receipt.result;
  END IF;
  IF item.updated_at<>expected_updated_at THEN RAISE EXCEPTION 'Draft changed; read it again' USING ERRCODE='P0409'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(patch) f WHERE f NOT IN ('title','summary','description','tags','facts','downloadSources')) THEN
    RAISE EXCEPTION 'Field is not editable' USING ERRCODE='P0422';
  END IF;
  IF (patch ? 'title' AND (jsonb_typeof(patch->'title')<>'string' OR length(btrim(patch->>'title')) NOT BETWEEN 1 AND 200))
    OR (patch ? 'summary' AND (jsonb_typeof(patch->'summary')<>'string' OR length(patch->>'summary')>500))
    OR (patch ? 'description' AND (jsonb_typeof(patch->'description')<>'string' OR length(patch->>'description')>20000)) THEN
    RAISE EXCEPTION 'Invalid text fields' USING ERRCODE='P0422';
  END IF;
  IF patch ? 'tags' THEN
    IF jsonb_typeof(patch->'tags') IS DISTINCT FROM 'array' OR jsonb_array_length(patch->'tags')>40 THEN RAISE EXCEPTION 'Invalid tags' USING ERRCODE='P0422'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(patch->'tags') t WHERE jsonb_typeof(t->'slug') IS DISTINCT FROM 'string' OR jsonb_typeof(t->'name') IS DISTINCT FROM 'string'
      OR t->>'slug' !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR length(t->>'slug') NOT BETWEEN 1 AND 120 OR length(btrim(t->>'name')) NOT BETWEEN 1 AND 60)
      OR jsonb_array_length(patch->'tags')<>(SELECT count(DISTINCT t->>'slug') FROM jsonb_array_elements(patch->'tags') t) THEN RAISE EXCEPTION 'Invalid tags' USING ERRCODE='P0422'; END IF;
    DELETE FROM catalog.item_tags WHERE item_id=target;
    WITH tags AS(INSERT INTO catalog.tags(slug,name) SELECT t->>'slug',btrim(t->>'name') FROM jsonb_array_elements(patch->'tags') t ON CONFLICT(slug) DO UPDATE SET slug=EXCLUDED.slug RETURNING id)
      INSERT INTO catalog.item_tags(item_id,tag_id) SELECT target,id FROM tags;
  END IF;
  IF patch ? 'facts' THEN
    SELECT metadata_schema_key INTO schema_key FROM catalog.categories WHERE id=item.category_id;
    IF schema_key='images.v1' THEN RAISE EXCEPTION 'Generated facts are not editable' USING ERRCODE='P0403'; END IF;
    IF jsonb_typeof(patch->'facts') IS DISTINCT FROM 'array' OR jsonb_array_length(patch->'facts')>20 THEN RAISE EXCEPTION 'Invalid facts' USING ERRCODE='P0422'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(patch->'facts') f WHERE jsonb_typeof(f->'key') IS DISTINCT FROM 'string' OR jsonb_typeof(f->'label') IS DISTINCT FROM 'string' OR jsonb_typeof(f->'value') IS DISTINCT FROM 'string'
      OR f->>'key' !~ '^[a-z][a-z0-9_]*$' OR length(f->>'key') NOT BETWEEN 1 AND 64 OR length(btrim(f->>'label')) NOT BETWEEN 1 AND 80 OR length(btrim(f->>'value')) NOT BETWEEN 1 AND 300)
      OR jsonb_array_length(patch->'facts')<>(SELECT count(DISTINCT f->>'key') FROM jsonb_array_elements(patch->'facts') f) THEN RAISE EXCEPTION 'Invalid facts' USING ERRCODE='P0422'; END IF;
    DELETE FROM catalog.item_facts WHERE item_id=target;
    INSERT INTO catalog.item_facts(item_id,key,label,value,sort_order) SELECT target,f->>'key',f->>'label',f->>'value',(ord-1)::integer FROM jsonb_array_elements(patch->'facts') WITH ORDINALITY x(f,ord);
  END IF;
  IF patch ? 'downloadSources' THEN
    IF jsonb_typeof(patch->'downloadSources') IS DISTINCT FROM 'array' OR jsonb_array_length(patch->'downloadSources')>40 THEN RAISE EXCEPTION 'Invalid sources' USING ERRCODE='P0422'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(patch->'downloadSources') s WHERE jsonb_typeof(s->'provider') IS DISTINCT FROM 'string' OR jsonb_typeof(s->'url') IS DISTINCT FROM 'string'
      OR s->>'provider' !~ '^[a-z][a-z0-9_]{0,59}$' OR length(s->>'url')>2048)
      OR jsonb_array_length(patch->'downloadSources')<>(SELECT count(DISTINCT s->>'provider') FROM jsonb_array_elements(patch->'downloadSources') s) THEN RAISE EXCEPTION 'Invalid sources' USING ERRCODE='P0422'; END IF;
    DELETE FROM catalog.item_download_sources ds WHERE item_id=target AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(patch->'downloadSources') s WHERE s->>'provider'=ds.source_slug);
    INSERT INTO catalog.item_download_sources(item_id,source_slug,url) SELECT target,s->>'provider',s->>'url' FROM jsonb_array_elements(patch->'downloadSources') s
      ON CONFLICT(item_id,source_slug) DO UPDATE SET url=EXCLUDED.url;
  END IF;
  UPDATE catalog.items SET title=CASE WHEN patch ? 'title' THEN btrim(patch->>'title') ELSE title END,
    summary=CASE WHEN patch ? 'summary' THEN patch->>'summary' ELSE summary END,
    description=CASE WHEN patch ? 'description' THEN patch->>'description' ELSE description END
    WHERE id=target;
  outcome:=automation.draft(k,h,target);
  INSERT INTO automation.draft_edits(agent_id,request_key,item_id,payload_hash,result) VALUES(a.id,request_key,target,body_hash,outcome);
  INSERT INTO automation.audit_events(agent_id,key_id,action,item_id) VALUES(a.id,k,'draft_updated',target);
  RETURN outcome;
END $$;

REVOKE ALL ON FUNCTION automation.drafts(uuid,text,bigint),automation.draft(uuid,text,bigint),automation.update_draft(uuid,text,bigint,text,text,timestamptz,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION automation.drafts(uuid,text,bigint),automation.draft(uuid,text,bigint),automation.update_draft(uuid,text,bigint,text,text,timestamptz,jsonb) TO pixinium_agent;

-- Preserve target-specific broker behavior (including download policy), changing only its obsolete scope check.
DO $migration$
DECLARE signature text; definition text;
BEGIN
  FOREACH signature IN ARRAY ARRAY['automation.start_job(uuid,text,text,text,bigint)','automation.publish_job(uuid,text,uuid,uuid,text,jsonb,text)'] LOOP
    definition:=pg_get_functiondef(signature::regprocedure);
    IF position('''content:publish''' IN definition)=0 THEN RAISE EXCEPTION 'Unexpected agent broker definition: %',signature; END IF;
    definition:=replace(definition,'''content:publish''','''content:create''');
    EXECUTE definition;
  END LOOP;
END $migration$;
