-- Only resolve private image locations after rechecking the agent's draft ownership.
-- Locations are consumed by the server, never returned to the MCP client.
CREATE FUNCTION automation.draft_image(k uuid,h text,target bigint,requested_asset bigint DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,automation,pg_temp AS $$
DECLARE a automation.agents; item catalog.items; image jsonb;
BEGIN
  a:=automation.check_key(k,h,'content:edit');
  SELECT i.* INTO item FROM catalog.items i JOIN automation.item_origins o ON o.item_id=i.id
    WHERE i.id=target AND o.agent_id=a.id AND i.status='draft' AND i.published_at IS NULL FOR SHARE OF i;
  IF NOT FOUND THEN RAISE EXCEPTION 'Draft access denied' USING ERRCODE='P0403'; END IF;
  PERFORM automation.check_key(k,h,'content:edit',item.category_id);
  SELECT jsonb_build_object('assetId',s.id::text,'bucket',s.bucket,'path',s.object_path) INTO image
    FROM catalog.item_assets ia JOIN catalog.assets s ON s.id=ia.asset_id
    WHERE ia.item_id=target AND s.provider='s3' AND s.media_type='image'
      AND (requested_asset IS NULL OR s.id=requested_asset)
    ORDER BY CASE ia.role WHEN 'cover' THEN 0 WHEN 'preview' THEN 1 ELSE 2 END,ia.sort_order,ia.id LIMIT 1;
  IF image IS NULL THEN RAISE EXCEPTION 'Draft image access denied' USING ERRCODE='P0403'; END IF;
  RETURN image;
END $$;
REVOKE ALL ON FUNCTION automation.draft_image(uuid,text,bigint,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION automation.draft_image(uuid,text,bigint,bigint) TO pixinium_agent;
