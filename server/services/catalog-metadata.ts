import { parseCategoryMetadata } from '../../lib/entities/metadata'

// Internal write boundary; no HTTP/Server Action is exposed. Supply a trusted
// admin connection, never the browser. Runtime roles cannot UPDATE catalog.items.
export interface CatalogWriteConnection {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>
}

/** Caller owns the surrounding transaction on a single dedicated connection. */
export async function updateItemMetadata(connection: CatalogWriteConnection, itemId: string, input: unknown) {
  if (!/^[1-9][0-9]*$/.test(itemId)) throw new Error('Invalid item ID')
  const result = await connection.query(`SELECT c.metadata_schema_key FROM catalog.items i
    JOIN catalog.categories c ON c.id = i.category_id WHERE i.id = $1 FOR UPDATE OF i FOR SHARE OF c`, [itemId])
  if (!result.rows.length) throw new Error('Item not found or not accessible')
  const key = result.rows[0].metadata_schema_key
  if (typeof key !== 'string') throw new Error('Invalid category metadata schema')
  const metadata = parseCategoryMetadata(key, input)
  await connection.query('UPDATE catalog.items SET metadata = $2::jsonb WHERE id = $1', [itemId, JSON.stringify(metadata)])
  return metadata
}
