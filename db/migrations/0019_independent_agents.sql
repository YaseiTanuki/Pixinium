-- Independent machine identities. No Supabase user or admin profile is required.
CREATE SCHEMA automation;
REVOKE ALL ON SCHEMA automation FROM PUBLIC;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pixinium_agent') THEN
    CREATE ROLE pixinium_agent NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END $$;
GRANT USAGE ON SCHEMA automation TO pixinium_agent;
ALTER DEFAULT PRIVILEGES IN SCHEMA automation REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

CREATE TABLE automation.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  active boolean NOT NULL DEFAULT true,
  allowed_categories bigint[] NOT NULL CHECK (cardinality(allowed_categories) BETWEEN 1 AND 100),
  requests_per_minute integer NOT NULL DEFAULT 60 CHECK (requests_per_minute BETWEEN 1 AND 1000),
  upload_bytes_per_day bigint NOT NULL DEFAULT 1073741824 CHECK (upload_bytes_per_day BETWEEN 1 AND 107374182400),
  jobs_per_day integer NOT NULL DEFAULT 100 CHECK (jobs_per_day BETWEEN 1 AND 10000),
  concurrent_jobs integer NOT NULL DEFAULT 2 CHECK (concurrent_jobs BETWEEN 1 AND 10),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE automation.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES automation.agents(id) ON DELETE RESTRICT,
  label text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 100),
  secret_hash text NOT NULL CHECK (secret_hash ~ '^[a-f0-9]{64}$'),
  scopes text[] NOT NULL CHECK (cardinality(scopes) > 0 AND scopes <@ ARRAY['catalog:read','uploads:write','content:create','content:publish']::text[]),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);
CREATE INDEX api_keys_agent_idx ON automation.api_keys(agent_id);
CREATE TABLE automation.usage_buckets (
  agent_id uuid NOT NULL REFERENCES automation.agents(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('requests','upload_bytes','jobs')),
  bucket timestamptz NOT NULL,
  units bigint NOT NULL CHECK (units >= 0),
  PRIMARY KEY (agent_id,kind,bucket)
);
CREATE TABLE automation.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES automation.agents(id) ON DELETE RESTRICT,
  key_id uuid NOT NULL REFERENCES automation.api_keys(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 128),
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  category_id bigint NOT NULL REFERENCES catalog.categories(id) ON DELETE RESTRICT,
  reserved_item_id bigint NOT NULL,
  state text NOT NULL DEFAULT 'processing' CHECK (state IN ('processing','succeeded','failed')),
  lease_token uuid NOT NULL DEFAULT gen_random_uuid(),
  lease_until timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts BETWEEN 1 AND 3),
  result jsonb CHECK (result IS NULL OR jsonb_typeof(result)='object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_id,idempotency_key)
);
CREATE INDEX jobs_agent_state_idx ON automation.jobs(agent_id,state,lease_until);
CREATE INDEX jobs_key_idx ON automation.jobs(key_id);
CREATE INDEX jobs_category_idx ON automation.jobs(category_id);
CREATE TABLE automation.uploads (
  path text PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES automation.agents(id) ON DELETE RESTRICT,
  key_id uuid NOT NULL REFERENCES automation.api_keys(id) ON DELETE RESTRICT,
  byte_size bigint NOT NULL CHECK (byte_size BETWEEN 1 AND 52428800),
  claimed_job uuid REFERENCES automation.jobs(id) ON DELETE RESTRICT,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX uploads_agent_idx ON automation.uploads(agent_id);
CREATE INDEX uploads_key_idx ON automation.uploads(key_id);
CREATE INDEX uploads_job_idx ON automation.uploads(claimed_job);
CREATE INDEX uploads_expiry_idx ON automation.uploads(expires_at);
CREATE TABLE automation.item_origins (
  item_id bigint PRIMARY KEY REFERENCES catalog.items(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES automation.agents(id) ON DELETE RESTRICT,
  key_id uuid NOT NULL REFERENCES automation.api_keys(id) ON DELETE RESTRICT,
  job_id uuid NOT NULL UNIQUE REFERENCES automation.jobs(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX item_origins_agent_idx ON automation.item_origins(agent_id);
CREATE INDEX item_origins_key_idx ON automation.item_origins(key_id);
CREATE TABLE automation.audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES automation.agents(id) ON DELETE RESTRICT,
  key_id uuid REFERENCES automation.api_keys(id) ON DELETE RESTRICT,
  job_id uuid REFERENCES automation.jobs(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('upload_reserved','upload_discarded','job_started','job_retried','job_failed','content_published','key_created','key_revoked','agent_disabled')),
  item_id bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_agent_time_idx ON automation.audit_events(agent_id,created_at);
CREATE INDEX audit_key_idx ON automation.audit_events(key_id);
CREATE INDEX audit_job_idx ON automation.audit_events(job_id);

-- The runtime has no direct table grants. All entry points recheck the key.
ALTER TABLE automation.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation.usage_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation.uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation.item_origins ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation.audit_events ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION automation.check_key(k uuid,h text,required_scope text,category bigint DEFAULT NULL)
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
  IF category IS NOT NULL AND (NOT category=ANY(principal.allowed_categories) OR NOT EXISTS(SELECT 1 FROM catalog.categories WHERE id=category AND is_active AND slug<>'stories')) THEN
    RAISE EXCEPTION 'Agent category denied' USING ERRCODE='P0403';
  END IF;
  RETURN principal;
END $$;

CREATE FUNCTION automation.consume(a uuid,kind_name text,start_at timestamptz,cost bigint,ceiling bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,automation,pg_temp AS $$
DECLARE used bigint;
BEGIN
  IF cost<1 OR cost>ceiling THEN RAISE EXCEPTION 'Agent quota exceeded' USING ERRCODE='P0429'; END IF;
  INSERT INTO automation.usage_buckets(agent_id,kind,bucket,units) VALUES(a,kind_name,start_at,cost)
    ON CONFLICT(agent_id,kind,bucket) DO UPDATE SET units=automation.usage_buckets.units+cost
    WHERE automation.usage_buckets.units+cost<=ceiling RETURNING units INTO used;
  IF used IS NULL THEN RAISE EXCEPTION 'Agent quota exceeded' USING ERRCODE='P0429'; END IF;
END $$;

CREATE FUNCTION automation.authenticate(k uuid,h text,required_scope text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,automation,pg_temp AS $$
DECLARE a automation.agents;
BEGIN
  -- Serialize key timestamp updates before taking shared authorization locks.
  -- This prevents concurrent requests from deadlocking while upgrading locks.
  PERFORM 1 FROM automation.api_keys WHERE id=k AND secret_hash=h FOR UPDATE;
  a:=automation.check_key(k,h,required_scope);
  PERFORM automation.consume(a.id,'requests',date_trunc('minute',now()),1,a.requests_per_minute);
  UPDATE automation.api_keys SET last_used_at=now() WHERE id=k;
  RETURN jsonb_build_object('id',a.id,'keyId',k);
END $$;

CREATE FUNCTION automation.catalog(k uuid,h text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,automation,pg_temp AS $$
DECLARE a automation.agents;
BEGIN
  a:=automation.check_key(k,h,'catalog:read');
  RETURN jsonb_build_object('categories',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id::text,'slug',slug,'name',name,'metadataSchemaKey',metadata_schema_key) ORDER BY sort_order,id) FROM catalog.categories WHERE is_active AND slug<>'stories' AND id=ANY(a.allowed_categories)),'[]'::jsonb),
    'tags',coalesce((SELECT jsonb_agg(jsonb_build_object('slug',slug,'name',name) ORDER BY name) FROM catalog.tags),'[]'::jsonb));
END $$;

CREATE FUNCTION automation.category(k uuid,h text,category_id bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,automation,pg_temp AS $$
BEGIN
  PERFORM automation.check_key(k,h,'content:create',category_id);
  RETURN (SELECT jsonb_build_object('slug',slug,'metadata_schema_key',metadata_schema_key) FROM catalog.categories WHERE id=category_id);
END $$;

CREATE FUNCTION automation.reserve_upload(k uuid,h text,object_path text,bytes bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,automation,pg_temp AS $$
DECLARE a automation.agents;
BEGIN
  a:=automation.check_key(k,h,'uploads:write');
  IF object_path !~ '^agents/[0-9a-f-]{36}/[0-9a-f-]{36}\.[a-z0-9]{1,10}$' OR object_path NOT LIKE 'agents/'||a.id::text||'/%' OR bytes NOT BETWEEN 1 AND 52428800 THEN
    RAISE EXCEPTION 'Invalid agent upload' USING ERRCODE='P0422';
  END IF;
  PERFORM automation.consume(a.id,'upload_bytes',date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC',bytes,a.upload_bytes_per_day);
  INSERT INTO automation.uploads(path,agent_id,key_id,byte_size) VALUES(object_path,a.id,k,bytes);
  INSERT INTO automation.audit_events(agent_id,key_id,action) VALUES(a.id,k,'upload_reserved');
END $$;

CREATE FUNCTION automation.discard_uploads(k uuid,h text,paths text[]) RETURNS text[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,automation,pg_temp AS $$
DECLARE a automation.agents; removed text[];
BEGIN
  a:=automation.check_key(k,h,'uploads:write');
  IF cardinality(paths)>51 OR EXISTS(SELECT 1 FROM unnest(paths) p WHERE p NOT LIKE 'agents/'||a.id::text||'/%') THEN
    RAISE EXCEPTION 'Upload owner mismatch' USING ERRCODE='P0403';
  END IF;
  IF EXISTS(SELECT 1 FROM automation.uploads u JOIN automation.jobs j ON j.id=u.claimed_job WHERE u.path=ANY(paths) AND j.state='processing' AND j.lease_until>clock_timestamp()) THEN
    RAISE EXCEPTION 'Upload is in use' USING ERRCODE='P0409';
  END IF;
  WITH gone AS(DELETE FROM automation.uploads WHERE agent_id=a.id AND path=ANY(paths) RETURNING path)
    SELECT coalesce(array_agg(path),'{}'::text[]) INTO removed FROM gone;
  INSERT INTO automation.audit_events(agent_id,key_id,action) VALUES(a.id,k,'upload_discarded');
  RETURN removed;
END $$;

CREATE FUNCTION automation.start_job(k uuid,h text,request_key text,body_hash text,category_id bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,automation,pg_temp AS $$
DECLARE a automation.agents; j automation.jobs;
BEGIN
  a:=automation.check_key(k,h,'content:create',category_id);
  PERFORM automation.check_key(k,h,'content:publish',category_id);
  IF request_key IS NULL OR length(request_key) NOT BETWEEN 1 AND 128 OR body_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid idempotency input' USING ERRCODE='P0422';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(a.id::text,0));
  SELECT * INTO j FROM automation.jobs WHERE agent_id=a.id AND idempotency_key=request_key FOR UPDATE;
  IF FOUND THEN
    IF j.payload_hash<>body_hash OR j.category_id<>category_id THEN RAISE EXCEPTION 'Idempotency key conflict' USING ERRCODE='P0409'; END IF;
    IF j.state='succeeded' THEN RETURN jsonb_build_object('state',j.state,'result',j.result); END IF;
    IF j.state='processing' AND j.lease_until>clock_timestamp() THEN RETURN jsonb_build_object('state','processing'); END IF;
    IF j.attempts>=3 THEN RAISE EXCEPTION 'Job retry limit reached' USING ERRCODE='P0409'; END IF;
  END IF;
  IF (SELECT count(*) FROM automation.jobs WHERE agent_id=a.id AND state='processing' AND lease_until>clock_timestamp())>=a.concurrent_jobs THEN
    RAISE EXCEPTION 'Agent concurrency quota exceeded' USING ERRCODE='P0429';
  END IF;
  IF j.id IS NULL THEN
    PERFORM automation.consume(a.id,'jobs',date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC',1,a.jobs_per_day);
    INSERT INTO automation.jobs(agent_id,key_id,idempotency_key,payload_hash,category_id,reserved_item_id)
      VALUES(a.id,k,request_key,body_hash,category_id,nextval(pg_get_serial_sequence('catalog.items','id'))) RETURNING * INTO j;
    INSERT INTO automation.audit_events(agent_id,key_id,job_id,action) VALUES(a.id,k,j.id,'job_started');
  ELSE
    UPDATE automation.jobs SET state='processing',key_id=k,lease_token=gen_random_uuid(),lease_until=now()+interval '10 minutes',attempts=attempts+1,updated_at=now() WHERE id=j.id RETURNING * INTO j;
    INSERT INTO automation.audit_events(agent_id,key_id,job_id,action) VALUES(a.id,k,j.id,'job_retried');
  END IF;
  RETURN jsonb_build_object('state','reserved','id',j.id,'leaseToken',j.lease_token,'itemId',j.reserved_item_id::text);
END $$;

CREATE FUNCTION automation.claim_uploads(k uuid,h text,job uuid,lease uuid,paths text[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,automation,pg_temp AS $$
DECLARE a automation.agents; j automation.jobs; claimed integer;
BEGIN
  a:=automation.check_key(k,h,'content:create');
  SELECT * INTO j FROM automation.jobs WHERE id=job AND agent_id=a.id AND state='processing' AND lease_token=lease AND lease_until>clock_timestamp() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job lease expired' USING ERRCODE='P0409'; END IF;
  IF cardinality(paths) NOT BETWEEN 1 AND 51 OR cardinality(paths)<>(SELECT count(DISTINCT x) FROM unnest(paths) x) THEN RAISE EXCEPTION 'Invalid attachment list' USING ERRCODE='P0422'; END IF;
  UPDATE automation.uploads SET claimed_job=job WHERE agent_id=a.id AND path=ANY(paths) AND expires_at>clock_timestamp() AND (claimed_job IS NULL OR claimed_job=job);
  GET DIAGNOSTICS claimed=ROW_COUNT;
  IF claimed<>cardinality(paths) THEN RAISE EXCEPTION 'Uploads unavailable or owned by another job' USING ERRCODE='P0403'; END IF;
END $$;

CREATE FUNCTION automation.content_slugs(k uuid,h text,category_id bigint,base text) RETURNS TABLE(slug text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,automation,pg_temp AS $$
BEGIN
  PERFORM automation.check_key(k,h,'content:create',category_id);
  RETURN QUERY SELECT i.slug FROM catalog.items i WHERE i.category_id=content_slugs.category_id AND (i.slug=base OR i.slug LIKE base||'-%');
END $$;

CREATE FUNCTION automation.job_state(k uuid,h text,job uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,automation,pg_temp AS $$
DECLARE a automation.agents;
BEGIN
  a:=automation.check_key(k,h,'content:create');
  RETURN (SELECT state FROM automation.jobs WHERE id=job AND agent_id=a.id);
END $$;

CREATE FUNCTION automation.fail_job(k uuid,h text,job uuid,lease uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,automation,pg_temp AS $$
DECLARE a automation.agents;
BEGIN
  a:=automation.check_key(k,h,'content:create');
  UPDATE automation.jobs SET state='failed',updated_at=now() WHERE id=job AND agent_id=a.id AND state='processing' AND lease_token=lease;
  IF FOUND THEN INSERT INTO automation.audit_events(agent_id,key_id,job_id,action) VALUES(a.id,k,job,'job_failed'); END IF;
END $$;

CREATE FUNCTION automation.publish_job(k uuid,h text,job uuid,lease uuid,schema_key text,doc jsonb,bucket_name text) RETURNS jsonb
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
    OVERRIDING SYSTEM VALUE VALUES(j.reserved_item_id,j.category_id,doc->>'slug',doc->>'title',doc->>'summary',coalesce(nullif(doc->>'description',doc->>'summary'),''),'published',now(),doc->>'accentColor',false,0,doc->'metadata');
  INSERT INTO catalog.item_facts(item_id,key,label,value,sort_order)
    SELECT j.reserved_item_id,f->>'key',f->>'label',f->>'value',(ord-1)::integer FROM jsonb_array_elements(doc->'facts') WITH ORDINALITY x(f,ord);
  WITH tags AS(INSERT INTO catalog.tags(slug,name) SELECT t->>'slug',t->>'name' FROM jsonb_array_elements(doc->'tags') t ON CONFLICT(slug) DO UPDATE SET slug=EXCLUDED.slug RETURNING id)
    INSERT INTO catalog.item_tags(item_id,tag_id) SELECT j.reserved_item_id,id FROM tags;
  WITH assets AS(INSERT INTO catalog.assets(provider,bucket,object_path,media_type,mime_type,byte_size,width,height,duration_seconds)
    SELECT 's3',bucket_name,f->>'path',f->>'mediaType',f->>'mime',(f->>'byteSize')::bigint,(f->>'width')::integer,(f->>'height')::integer,(f->>'durationSeconds')::numeric FROM jsonb_array_elements(doc->'attachments') f RETURNING id,object_path)
    INSERT INTO catalog.item_assets(item_id,asset_id,role,alt_text,focal_x,focal_y,sort_order)
    SELECT j.reserved_item_id,assets.id,f->>'role',f->>'altText',(f->>'focalX')::numeric,(f->>'focalY')::numeric,(ord-1)::integer
    FROM jsonb_array_elements(doc->'attachments') WITH ORDINALITY x(f,ord) JOIN assets ON assets.object_path=f->>'path';
  outcome:=jsonb_build_object('id',j.reserved_item_id::text,'slug',doc->>'slug','category',category_slug,'href','/items/'||category_slug||'/'||(doc->>'slug'),'message','Content published to the archive.');
  INSERT INTO automation.item_origins(item_id,agent_id,key_id,job_id) VALUES(j.reserved_item_id,a.id,k,job);
  UPDATE automation.jobs SET state='succeeded',result=outcome,updated_at=now() WHERE id=job;
  INSERT INTO automation.audit_events(agent_id,key_id,job_id,action,item_id) VALUES(a.id,k,job,'content_published',j.reserved_item_id);
  RETURN outcome;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA automation FROM PUBLIC,pixinium_agent;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA automation FROM PUBLIC,pixinium_agent;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA automation FROM PUBLIC,pixinium_agent;
GRANT EXECUTE ON FUNCTION automation.authenticate(uuid,text,text),automation.catalog(uuid,text),automation.category(uuid,text,bigint),
  automation.reserve_upload(uuid,text,text,bigint),automation.discard_uploads(uuid,text,text[]),automation.start_job(uuid,text,text,text,bigint),
  automation.claim_uploads(uuid,text,uuid,uuid,text[]),automation.content_slugs(uuid,text,bigint,text),automation.job_state(uuid,text,uuid),
  automation.fail_job(uuid,text,uuid,uuid),automation.publish_job(uuid,text,uuid,uuid,text,jsonb,text) TO pixinium_agent;
