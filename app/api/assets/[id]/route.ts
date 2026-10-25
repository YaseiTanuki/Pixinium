import { neon } from '@neondatabase/serverless'
import { NextResponse } from 'next/server'
import { adminStorage, signDownload, readAudioStream } from '@/server/services/storage.service'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }
  const { id } = await params
  if (!/^[1-9][0-9]{0,18}$/.test(id)) return new NextResponse(null, { status: 404, headers })
  try {
    if (!process.env.DATABASE_URL) throw new Error('Catalog unavailable')
    const sql = neon(process.env.DATABASE_URL)
    const rows = await sql`SELECT a.bucket, a.object_path, a.media_type, a.mime_type, bool_or(ia.role = 'download') AS download
      FROM catalog.assets a JOIN catalog.item_assets ia ON ia.asset_id = a.id
      JOIN catalog.items i ON i.id = ia.item_id JOIN catalog.categories c ON c.id = i.category_id
      WHERE a.id = ${id}::bigint AND a.provider = 's3' AND i.status = 'published' AND c.is_active
      GROUP BY a.id, a.bucket, a.object_path`
    if (!rows[0]) return new NextResponse(null, { status: 404, headers })
    const { bucket } = adminStorage()
    if (rows[0].bucket !== bucket) return new NextResponse(null, { status: 404, headers })
    if (new URL(request.url).searchParams.get('play') === '1') {
      if (rows[0].media_type !== 'audio' || !rows[0].download) return new NextResponse(null, { status: 404, headers })
      const range = request.headers.get('range') ?? undefined
      if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) return new NextResponse(null, { status: 416, headers })
      const audio = await readAudioStream(String(rows[0].object_path), range)
      if (!audio.Body) return new NextResponse(null, { status: 404, headers })
      return new Response(audio.Body.transformToWebStream(), {
        status: audio.ContentRange ? 206 : 200,
        headers: { ...headers, 'Content-Type': String(rows[0].mime_type || 'application/octet-stream'),
          'Content-Disposition': 'inline', 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff',
          ...(audio.ContentLength !== undefined ? { 'Content-Length': String(audio.ContentLength) } : {}),
          ...(audio.ContentRange ? { 'Content-Range': audio.ContentRange } : {}),
        },
      })
    }
    const url = await signDownload(String(rows[0].object_path), Boolean(rows[0].download))
    return new NextResponse(null, { status: 307, headers: { ...headers, Location: url } })
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
    return new NextResponse(null, { status: status === 416 ? 416 : status === 404 ? 404 : 503, headers })
  }
}
