-- Application roles only. Login passwords are provisioned separately, never committed.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='pixinium_runtime') THEN
    CREATE ROLE pixinium_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='pixinium_catalog_admin') THEN
    CREATE ROLE pixinium_catalog_admin NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='pixinium_agent_api') THEN
    CREATE ROLE pixinium_agent_api NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOBYPASSRLS;
  END IF;
END $$;
GRANT USAGE ON SCHEMA catalog TO pixinium_runtime,pixinium_catalog_admin;
GRANT SELECT ON ALL TABLES IN SCHEMA catalog TO pixinium_runtime;
GRANT INSERT,UPDATE ON catalog.profiles TO pixinium_runtime;
GRANT INSERT,UPDATE,DELETE ON catalog.collections,catalog.collection_items TO pixinium_runtime;
GRANT USAGE,SELECT ON SEQUENCE catalog.collections_id_seq TO pixinium_runtime;
GRANT UPDATE(view_count,download_count) ON catalog.items TO pixinium_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA catalog TO pixinium_catalog_admin;
GRANT USAGE,SELECT,UPDATE ON ALL SEQUENCES IN SCHEMA catalog TO pixinium_catalog_admin;
GRANT pixinium_agent TO pixinium_agent_api;

DO $$ DECLARE relation record; BEGIN
  FOR relation IN SELECT tablename FROM pg_tables WHERE schemaname='catalog' LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='catalog' AND tablename=relation.tablename AND policyname='catalog_admin_access') THEN
      EXECUTE format('CREATE POLICY catalog_admin_access ON catalog.%I TO pixinium_catalog_admin USING (true) WITH CHECK (true)',relation.tablename);
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='catalog' AND tablename='items' AND policyname='runtime_counters') THEN
    CREATE POLICY runtime_counters ON catalog.items FOR UPDATE TO pixinium_runtime
      USING (status='published') WITH CHECK (status='published');
  END IF;
END $$;
