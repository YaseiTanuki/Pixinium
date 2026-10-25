import { neon } from '@neondatabase/serverless'
import { S3Client, CopyObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { itemStorageDirectory } from '../lib/admin/storage-paths'

// Run without --apply to inspect. Copies are verified before references change.
async function main() {
  if (!process.env.CATALOG_ADMIN_DATABASE_URL) throw new Error('Missing catalog writer')
  const sql = neon(process.env.CATALOG_ADMIN_DATABASE_URL)
  const storage = new S3Client({ forcePathStyle: true })
  const bucket = process.env.S3_ASSETS_BUCKET || 'pixinium'
  const apply = process.argv.includes('--apply')
  let migrated = 0
  try {
    const rows = await sql.query(`SELECT ia.id::text, ia.item_id::text, ia.asset_id::text, ia.role,
      a.object_path, a.mime_type, c.slug AS category
      FROM catalog.item_assets ia JOIN catalog.assets a ON a.id = ia.asset_id
      JOIN catalog.items i ON i.id = ia.item_id JOIN catalog.categories c ON c.id = i.category_id
      WHERE a.provider = 's3' AND a.bucket = $1 ORDER BY ia.id`, [bucket])
    for (const row of rows) {
      const directory = itemStorageDirectory(String(row.category), String(row.item_id))
      const oldPath = String(row.object_path)
      if (oldPath === `${directory}/thumbnail.webp` || (row.role === 'download' && oldPath.startsWith(`${directory}/originals/`))) continue
      const extension = oldPath.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase()
      if (!extension) throw new Error('Source has no supported extension')
      if (row.role === 'cover' && row.mime_type !== 'image/webp') throw new Error('Run thumbnail backfill before layout migration')
      const destination = row.role === 'cover' ? `${directory}/thumbnail.webp` : `${directory}/originals/${row.asset_id}.${extension}`
      console.log(`${apply ? 'Migrate' : 'Plan'} ${oldPath} -> ${destination}`)
      if (!apply) continue
      const source = await storage.send(new HeadObjectCommand({ Bucket: bucket, Key: oldPath })).catch(error => {
        if (error?.$metadata?.httpStatusCode === 404) throw new Error(`Missing source object: ${oldPath}. Restore it before retrying; database references are unchanged.`)
        throw error
      })
      if (!source.ETag || !source.ContentLength) throw new Error('Invalid source object')
      // A previous interrupted run may already have copied the destination.
      let copied
      try { copied = await storage.send(new HeadObjectCommand({ Bucket: bucket, Key: destination })) }
      catch (error) { if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 404) throw error }
      if (!copied) {
        await storage.send(new CopyObjectCommand({ Bucket: bucket, Key: destination,
          CopySource: `${bucket}/${oldPath}`.split('/').map(encodeURIComponent).join('/'), CopySourceIfMatch: source.ETag }))
        copied = await storage.send(new HeadObjectCommand({ Bucket: bucket, Key: destination }))
      }
      if (copied.ETag !== source.ETag || copied.ContentLength !== source.ContentLength || copied.ContentType !== source.ContentType) {
        throw new Error('Destination verification failed; source and database preserved')
      }
      // Clone per relationship so shared source assets remain valid for other items.
      const result = await sql.query(`WITH current_link AS MATERIALIZED (
        SELECT id FROM catalog.item_assets WHERE id = $1::bigint AND asset_id = $2::bigint FOR UPDATE
      ), asset AS (
        INSERT INTO catalog.assets(provider,bucket,object_path,media_type,mime_type,byte_size,width,height,duration_seconds)
        SELECT a.provider,a.bucket,$3,a.media_type,a.mime_type,a.byte_size,a.width,a.height,a.duration_seconds
        FROM catalog.assets a CROSS JOIN current_link WHERE a.id = $2::bigint RETURNING id
      ) UPDATE catalog.item_assets ia SET asset_id = asset.id FROM asset
        WHERE ia.id = $1::bigint RETURNING ia.id`, [row.id,row.asset_id,destination])
      if (result.length !== 1) throw new Error('Attachment changed during migration; source preserved')
      migrated++
    }
    // Keep obsolete asset rows until object deletion succeeds, allowing cleanup retries.
    if (apply) {
      const obsolete = await sql.query(`SELECT a.id::text,a.object_path FROM catalog.assets a
        WHERE provider = 's3' AND bucket = $1 AND object_path LIKE 'content/%'
        AND NOT EXISTS (SELECT 1 FROM catalog.item_assets ia WHERE ia.asset_id = a.id)`, [bucket])
      for (const asset of obsolete) {
        await storage.send(new DeleteObjectCommand({ Bucket: bucket, Key: String(asset.object_path) }))
        await sql.query(`DELETE FROM catalog.assets a WHERE id = $1::bigint
          AND NOT EXISTS (SELECT 1 FROM catalog.item_assets ia WHERE ia.asset_id = a.id)`, [asset.id])
      }
      console.log(`Migrated ${migrated} attachments; removed ${obsolete.length} unreferenced legacy objects.`)
    } else console.log('Preview only. Use --apply to migrate.')
  } finally { storage.destroy() }
}
main().catch(error => {
  console.error('Storage status:', error?.$metadata?.httpStatusCode ?? null, 'code:', error?.name ?? null)
  console.error('Storage migration stopped:', error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted]') : 'Unknown error')
  process.exitCode = 1
})
