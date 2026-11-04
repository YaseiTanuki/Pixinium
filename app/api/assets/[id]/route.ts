import { neon } from '@neondatabase/serverless'
import { NextResponse } from 'next/server'
import { adminStorage, signDownload, readStoredStream } from '@/server/services/storage.service'
import { CONTENT_SCHEMAS } from '@/lib/content-types'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }
  const { id } = await params
  if (!/^[1-9][0-9]{0,18}$/.test(id)) return new NextResponse(null, { status: 404, headers })
  try {
    if (!process.env.DATABASE_URL) throw new Error('Catalog unavailable')
    const sql = neon(process.env.DATABASE_URL)
    const rows = await sql`SELECT a.bucket, a.object_path, a.media_type, a.mime_type, bool_or(ia.role = 'download') AS download,
      bool_and(c.metadata_schema_key = ${CONTENT_SCHEMAS.image}) AS image_only
      FROM catalog.assets a JOIN catalog.item_assets ia ON ia.asset_id = a.id
      JOIN catalog.items i ON i.id = ia.item_id JOIN catalog.categories c ON c.id = i.category_id
      WHERE a.id = ${id}::bigint AND a.provider = 's3' AND i.status = 'published' AND c.is_active
      GROUP BY a.id, a.bucket, a.object_path`
    if (!rows[0]) return new NextResponse(null, { status: 404, headers })
    const { bucket } = adminStorage()
    if (rows[0].bucket !== bucket) return new NextResponse(null, { status: 404, headers })
    const play = new URL(request.url).searchParams.get('play') === '1'
    if (play && (rows[0].media_type !== 'audio' || !rows[0].download)) return new NextResponse(null, { status: 404, headers })
    if (rows[0].download) {
      // Only image-category originals duplicate their thumbnail. A shared asset
      // used by another category remains indexable, regardless of its MIME type.
      const downloadHeaders = { ...headers, ...(rows[0].image_only ? { 'X-Robots-Tag': 'noindex' } : {}) }
      const range = request.headers.get('range') ?? undefined
      if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) return new NextResponse(null, { status: 416, headers: downloadHeaders })
      const file = await readStoredStream(String(rows[0].object_path), range)
      if (!file.Body) return new NextResponse(null, { status: 404, headers: downloadHeaders })
      if (!play) {
        await sql`UPDATE catalog.items SET download_count = download_count + 1 WHERE id IN (
          SELECT item_id FROM catalog.item_assets WHERE asset_id = ${id}::bigint AND role = 'download')`
      }
      return new Response(file.Body.transformToWebStream(), {
        status: file.ContentRange ? 206 : 200,
        headers: { ...downloadHeaders, 'Content-Type': String(rows[0].mime_type || 'application/octet-stream'),
          'Content-Disposition': play ? 'inline' : rows[0].mime_type === 'application/zip' ? `attachment; filename="asset-pack-${id}.zip"` : 'attachment',
          'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff',
          ...(file.ContentLength !== undefined ? { 'Content-Length': String(file.ContentLength) } : {}),
          ...(file.ContentRange ? { 'Content-Range': file.ContentRange } : {}),
        },
      })
    }
    const url = await signDownload(String(rows[0].object_path), false)
    return new NextResponse(null, { status: 307, headers: { ...headers, Location: url } })
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
    return new NextResponse(null, { status: status === 416 ? 416 : status === 404 ? 404 : 503, headers })
  }
}
