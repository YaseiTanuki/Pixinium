import { createDatabase } from '@/lib/database'
import { NextResponse } from 'next/server'
import { getAccount } from '@/server/services/auth.service'
import { hasPermission } from '@/lib/auth/permissions'
import { adminStorage, readStoredStream, signDownload } from '@/server/services/storage.service'

/** Private media review. Public /api/assets/:id continues to deny drafts. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', Vary: 'Cookie' }
  try {
    const account = await getAccount()
    if (!account || !hasPermission(account.role, 'admin:access')) return new NextResponse(null, { status: 403, headers })
    const { id } = await params
    if (!/^[1-9][0-9]{0,18}$/.test(id) || BigInt(id) > BigInt('9223372036854775807')) return new NextResponse(null, { status: 404, headers })
    if (!process.env.CATALOG_ADMIN_DATABASE_URL) return new NextResponse(null, { status: 503, headers })
    const [asset] = await createDatabase(process.env.CATALOG_ADMIN_DATABASE_URL).query(`SELECT a.bucket, a.object_path, a.media_type, a.mime_type
      FROM catalog.assets a WHERE a.id = $1::bigint AND a.provider = 's3'
      AND EXISTS (SELECT 1 FROM catalog.item_assets ia JOIN catalog.items i ON i.id = ia.item_id WHERE ia.asset_id = a.id)`, [id])
    if (!asset || asset.bucket !== adminStorage().bucket) return new NextResponse(null, { status: 404, headers })
    const download = new URL(request.url).searchParams.get('download') === '1'
    if (asset.media_type === 'audio' && !download) {
      const range = request.headers.get('range') ?? undefined
      if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) return new NextResponse(null, { status: 416, headers })
      const audio = await readStoredStream(String(asset.object_path), range)
      if (!audio.Body) return new NextResponse(null, { status: 404, headers })
      return new Response(audio.Body.transformToWebStream(), { status: audio.ContentRange ? 206 : 200, headers: {
        ...headers, 'Content-Type': String(asset.mime_type || 'application/octet-stream'), 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff',
        ...(audio.ContentLength !== undefined ? { 'Content-Length': String(audio.ContentLength) } : {}),
        ...(audio.ContentRange ? { 'Content-Range': audio.ContentRange } : {}),
      } })
    }
    const url = await signDownload(String(asset.object_path), download)
    return new NextResponse(null, { status: 307, headers: { ...headers, Location: url } })
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
    return new NextResponse(null, { status: status === 416 ? 416 : status === 404 ? 404 : 503, headers })
  }
}
