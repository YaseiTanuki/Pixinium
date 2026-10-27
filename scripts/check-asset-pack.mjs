// Live smoke test: run the built app on localhost:3210 first.
// Creates one temporary published pack, then deletes its rows and storage objects.
// node --env-file=.env.local --env-file=.env.agent.local --import tsx scripts/check-asset-pack.mjs
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { unzipSync } from 'fflate'
import { neon } from '@neondatabase/serverless'
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { deleteContentQuery } from '../server/repositories/content-delete.ts'

const origin = 'http://127.0.0.1:3210'
const token = process.env.AGENT_API_TOKEN
const actor = process.env.AGENT_API_ADMIN_ID
if (!token || !actor || !process.env.CATALOG_ADMIN_DATABASE_URL) throw new Error('Smoke test credentials are missing')
const sql = neon(process.env.CATALOG_ADMIN_DATABASE_URL)
const title = `Asset pack smoke ${randomUUID()}`
const staged = []
let createdId

async function api(path, method = 'GET', body) {
  const response = await fetch(`${origin}/api/agent/${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(`Local ${path} request failed (${response.status}): ${data.error ?? 'Unknown error'}`)
  return data
}

try {
  const catalog = await api('catalog')
  const category = catalog.categories.find(entry => entry.metadataSchemaKey === 'assets.v1')
  assert.ok(category, 'Assets category must exist')
  const original = await sharp({ create: { width: 24, height: 16, channels: 3, background: '#44aa77' } }).png().toBuffer()
  const cover = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#aa4477' } }).png().toBuffer()
  const attachments = []
  for (let index = 0; index < 7; index += 1) {
    const bytes = index === 0 ? cover : original
    const fileName = index === 0 ? 'cover.png' : `image-${index}.png`
    const upload = await api('uploads', 'POST', { name: fileName, size: bytes.length })
    staged.push(upload.path)
    const response = await fetch(upload.url, { method: 'PUT', headers: upload.headers, body: bytes })
    assert.ok(response.ok, 'Storage upload must succeed')
    attachments.push({ path: upload.path, fileName, altText: fileName, role: index === 0 ? 'cover' : 'download' })
  }
  const created = await api('content', 'POST', { categoryId: category.id, title, attachments })
  createdId = created.id
  const assets = await sql.query(`SELECT a.id::text,a.mime_type,ia.role FROM catalog.assets a
    JOIN catalog.item_assets ia ON ia.asset_id=a.id WHERE ia.item_id=$1::bigint ORDER BY ia.sort_order`, [createdId])
  assert.equal(assets.filter(asset => asset.role === 'cover').length, 1)
  assert.equal(assets.filter(asset => asset.role === 'preview').length, 5)
  const downloads = assets.filter(asset => asset.role === 'download')
  assert.equal(downloads.length, 1)
  assert.equal(downloads[0].mime_type, 'application/zip')
  const zipResponse = await fetch(`${origin}/api/assets/${downloads[0].id}`)
  assert.ok(zipResponse.ok)
  assert.match(zipResponse.headers.get('content-disposition') ?? '', /attachment; filename=".*\.zip"/)
  const entries = unzipSync(new Uint8Array(await zipResponse.arrayBuffer()))
  assert.equal(Object.keys(entries).length, 6)
  assert.ok(Object.keys(entries).every(name => !name.includes('cover')))
  for (const bytes of Object.values(entries)) assert.deepEqual(Buffer.from(bytes), original)
  const preview = assets.find(asset => asset.role === 'preview')
  const previewResponse = await fetch(`${origin}/api/assets/${preview.id}`)
  assert.ok(previewResponse.ok)
  assert.equal(previewResponse.headers.get('content-disposition'), 'inline')
  assert.equal((await sharp(Buffer.from(await previewResponse.arrayBuffer())).metadata()).format, 'webp')
  const page = await fetch(new URL(created.href, origin))
  assert.equal(page.status, 200)
  const html = await page.text()
  assert.ok(html.includes('id="asset-pack-preview-title">Preview</h2>'))
  assert.ok(html.includes('Download ZIP'))
  assert.match(html, /class="asset-pack-preview-row"/)
  const previewSection = html.match(/<section class="asset-pack-preview"[\s\S]*?<\/section>/)?.[0] ?? ''
  assert.equal((previewSection.match(/<img[ >]/g) ?? []).length, 5)
  console.log('PASS: upload, publish, five previews, six exact originals in ZIP, separate cover, inline previews, rendered detail page.')
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Asset pack smoke test failed')
  process.exitCode = 1
} finally {
  // Recover by the unique title if an API transport error hid a successful commit.
  const rows = await sql.query("SELECT i.id::text FROM catalog.items i JOIN catalog.categories c ON c.id=i.category_id WHERE i.title=$1 AND c.metadata_schema_key='assets.v1'", [title])
  for (const row of rows) {
    if (createdId && row.id !== createdId) throw new Error('Unexpected smoke test identity')
    const [deleted] = await sql.query(deleteContentQuery, [actor, row.id])
    if (!deleted) throw new Error('Could not remove smoke test content')
    const storage = new S3Client({ forcePathStyle: true })
    try {
      for (const asset of deleted.assets) {
        if (asset.provider !== 's3' || asset.bucket !== (process.env.S3_ASSETS_BUCKET || 'assets') || !asset.object_path.startsWith(`assets/${row.id}/`)) {
          throw new Error('Unexpected smoke test storage path')
        }
        await storage.send(new DeleteObjectCommand({ Bucket: asset.bucket, Key: asset.object_path }))
      }
    } finally { storage.destroy() }
  }
  if (staged.length) await api('uploads', 'DELETE', staged)
  console.log('Temporary smoke test content and uploaded files removed.')
}
