import { itemStorageDirectory } from '../lib/admin/storage-paths'
import { neon } from '@neondatabase/serverless'
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { createImageThumbnail } from '../server/services/image-thumbnail'

async function main() {
  if (!process.env.CATALOG_ADMIN_DATABASE_URL) throw new Error('Missing catalog writer')
  const sql = neon(process.env.CATALOG_ADMIN_DATABASE_URL)
  const storage = new S3Client({ forcePathStyle: true })
  const bucket = process.env.S3_ASSETS_BUCKET || 'assets'
  const rows = await sql.query(`SELECT ia.id::text, ia.asset_id::text, ia.item_id::text, a.object_path, c.slug AS category
    FROM catalog.item_assets ia JOIN catalog.assets a ON a.id = ia.asset_id
    JOIN catalog.items i ON i.id = ia.item_id JOIN catalog.categories c ON c.id = i.category_id
    WHERE ia.role = 'cover' AND a.provider = 's3' AND a.bucket = $1
      AND a.object_path NOT LIKE '%-thumb.webp' AND a.object_path NOT LIKE '%/thumbnail.webp'`, [bucket])
  let updated = 0
  try {
    for (const row of rows) {
      const original = await storage.send(new GetObjectCommand({ Bucket: bucket, Key: String(row.object_path) }))
      if (!original.Body || !original.ContentLength || original.ContentLength > 50 * 1024 * 1024) throw new Error('Invalid original')
      const bytes = await original.Body.transformToByteArray()
      const thumbnail = await createImageThumbnail(bytes)
      const path = `${itemStorageDirectory(String(row.category), String(row.item_id))}/thumbnail.webp`
      await storage.send(new PutObjectCommand({ Bucket: bucket, Key: path, Body: thumbnail.data, ContentType: 'image/webp' }))
      try {
        const result = await sql.query(`WITH asset AS (
          INSERT INTO catalog.assets(provider,bucket,object_path,media_type,mime_type,byte_size,width,height)
          VALUES ('s3',$1,$2,'image','image/webp',$3,$4,$5) RETURNING id
        ) UPDATE catalog.item_assets SET asset_id = asset.id FROM asset
          WHERE catalog.item_assets.id = $6::bigint AND catalog.item_assets.asset_id = $7::bigint
          RETURNING catalog.item_assets.id`, [bucket,path,thumbnail.data.length,thumbnail.width,thumbnail.height,row.id,row.asset_id])
        if (result.length) updated++
      } catch (error) {
        await storage.send(new DeleteObjectCommand({ Bucket: bucket, Key: path }))
        throw error
      }
    }
    console.log(`Generated thumbnails for ${updated} existing S3 covers; original downloads preserved.`)
  } finally { storage.destroy() }
}
main().catch(() => { console.error('Thumbnail backfill failed. Originals remain intact.'); process.exitCode = 1 })
