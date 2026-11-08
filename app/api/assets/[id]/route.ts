import { createDatabase } from '@/lib/database'
import { NextResponse } from 'next/server'
import { adminStorage, inspectStoredFile, readStoredStream } from '@/server/services/storage.service'
import { CONTENT_SCHEMAS } from '@/lib/content-types'

type Context = { params: Promise<{ id: string }> }

export function GET(request: Request, context: Context) {
  return serveAsset(request, context, false)
}

export function HEAD(request: Request, context: Context) {
  return serveAsset(request, context, true)
}

async function serveAsset(request: Request, { params }: Context, head: boolean) {
  const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }
  const { id } = await params
  if (!/^[1-9][0-9]{0,18}$/.test(id)) return new NextResponse(null, { status: 404, headers })
  try {
    if (!process.env.DATABASE_URL) throw new Error('Catalog unavailable')
    const sql = createDatabase(process.env.DATABASE_URL)
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
    const view = new URL(request.url).searchParams.get('view') === '1'
    if (play && (rows[0].media_type !== 'audio' || !rows[0].download)) return new NextResponse(null, { status: 404, headers })
    if (view && (!rows[0].download || rows[0].media_type !== 'image')) return new NextResponse(null, { status: 404, headers })
    const imageThumbnail = rows[0].image_only && rows[0].media_type === 'image' && !rows[0].download
    const inline = !rows[0].download || play || view
    const range = head ? undefined : request.headers.get('range') ?? undefined
    const cacheImage = inline && rows[0].media_type === 'image' && !range
    const responseHeaders = {
      ...headers,
      // Revalidate public status before cached bytes can be reused, including after takedowns.
      ...(cacheImage ? { 'Cache-Control': 'private, no-cache' } : {}),
      ...(imageThumbnail ? { 'X-Robots-Tag': 'noindex' } : {}),
    }
    if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) return new NextResponse(null, { status: 416, headers: responseHeaders })
    const ifNoneMatch = cacheImage ? request.headers.get('if-none-match') : null
    const path = String(rows[0].object_path)
    const metadata = head || ifNoneMatch ? await inspectStoredFile(path) : null
    const validators = (file: { ETag?: string; LastModified?: Date }) => ({
      ...(file.ETag ? { ETag: file.ETag } : {}),
      ...(file.LastModified ? { 'Last-Modified': file.LastModified.toUTCString() } : {}),
    })
    if (metadata && ifNoneMatch && (ifNoneMatch.trim() === '*' || (metadata.ETag && ifNoneMatch.split(',').some(tag => tag.trim().replace(/^W\//, '') === metadata.ETag)))) {
      return new Response(null, { status: 304, headers: { ...responseHeaders, ...validators(metadata) } })
    }
    const file = head ? metadata! : await readStoredStream(path, range)
    const body = 'Body' in file ? file.Body : undefined
    if (!head && !body) return new NextResponse(null, { status: 404, headers })
    if (!head && rows[0].download && !play && !view) {
      await sql`UPDATE catalog.items SET download_count = download_count + 1 WHERE id IN (
        SELECT item_id FROM catalog.item_assets WHERE asset_id = ${id}::bigint AND role = 'download')`
    }
    const contentRange = 'ContentRange' in file ? file.ContentRange : undefined
    return new Response(body ? body.transformToWebStream() : null, {
      status: contentRange ? 206 : 200,
      headers: { ...responseHeaders, ...validators(file), 'Content-Type': String(rows[0].mime_type || 'application/octet-stream'),
        'Content-Disposition': inline ? 'inline' : rows[0].mime_type === 'application/zip' ? `attachment; filename="asset-pack-${id}.zip"` : 'attachment',
        'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff',
        ...(file.ContentLength !== undefined ? { 'Content-Length': String(file.ContentLength) } : {}),
        ...(contentRange ? { 'Content-Range': contentRange } : {}),
      },
    })
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
    return new NextResponse(null, { status: status === 416 ? 416 : status === 404 ? 404 : 503, headers })
  }
}
