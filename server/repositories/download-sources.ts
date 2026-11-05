export const downloadProvidersQuery = `SELECT slug,name,kind,hostname,priority,is_active AS "isActive"
  FROM catalog.download_sources WHERE is_active ORDER BY priority,slug`
export const managedDownloadProvidersQuery = `SELECT s.slug,s.name,s.kind,s.hostname,s.priority,s.is_active AS "isActive",
  CASE WHEN s.kind='internal' THEN (SELECT count(DISTINCT item_id)::int FROM catalog.item_assets WHERE role='download')
    ELSE (SELECT count(*)::int FROM catalog.item_download_sources WHERE source_slug=s.slug) END AS "itemCount"
  FROM catalog.download_sources s ORDER BY s.priority,s.slug`
export const createDownloadProviderQuery = `WITH actor AS MATERIALIZED (
  SELECT id FROM catalog.profiles WHERE id=$1::uuid AND role='admin' FOR SHARE
) INSERT INTO catalog.download_sources(slug,name,kind,hostname,priority,is_active)
  SELECT $2,$3,'external',$4,$5::int,$6::boolean FROM actor RETURNING slug`
export const updateDownloadProviderQuery = `WITH actor AS MATERIALIZED (
  SELECT id FROM catalog.profiles WHERE id=$1::uuid AND role='admin' FOR SHARE
) UPDATE catalog.download_sources SET name=$3,hostname=$4,priority=$5::int,is_active=$6::boolean
  FROM actor WHERE slug=$2 RETURNING slug`
export const deleteDownloadProviderQuery = `WITH actor AS MATERIALIZED (
  SELECT id FROM catalog.profiles WHERE id=$1::uuid AND role='admin' FOR SHARE
) DELETE FROM catalog.download_sources USING actor WHERE slug=$2 AND kind='external' RETURNING slug`
