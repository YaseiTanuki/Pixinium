import { createDatabase } from '@/lib/database'
import { CONTENT_SCHEMAS } from '@/lib/content-types'
import { PLAYABLE_GAME_TAG } from '@/lib/admin/game'
import { SWF_MIME } from '@/lib/game-swf'
import { swfPlayerDocument } from '@/lib/game-player-document'
import { adminStorage, readStoredStream } from '@/server/services/storage.service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ id: string; path?: string[] }> }) {
  const { id, path = [] } = await params
  const headers = {
    'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex', 'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer', 'Access-Control-Allow-Origin': '*',
    // Also enforce the opaque origin on direct visits, not just the embedding iframe.
    'Content-Security-Policy': "sandbox allow-scripts allow-pointer-lock allow-forms allow-popups allow-popups-to-escape-sandbox; default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net 'self'; style-src 'unsafe-inline' 'self'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self' https://cdn.jsdelivr.net; worker-src blob:; frame-ancestors 'self'; form-action http: https:; base-uri 'none'",
  }
  const missing = () => new Response('This game is unavailable for browser play.', { status: 404, headers })
  if (!/^[1-9][0-9]{0,18}$/.test(id)) return missing()
  const filePath = path.join('/')
  if (filePath && (path.length !== 1 || filePath !== 'game.swf')) return missing()
  try {
    const sql = createDatabase(process.env.DATABASE_URL!)
    // Check publication, category, tag and the stored SWF type on every request.
    const rows = await sql`SELECT a.bucket, a.object_path
      FROM catalog.items i JOIN catalog.categories c ON c.id = i.category_id
      JOIN catalog.item_assets ia ON ia.item_id = i.id AND ia.role = 'download'
      JOIN catalog.assets a ON a.id = ia.asset_id
      WHERE i.id = ${id}::bigint AND i.status = 'published' AND c.is_active
        AND c.metadata_schema_key = ${CONTENT_SCHEMAS.game} AND a.provider = 's3' AND a.mime_type = ${SWF_MIME}
        AND EXISTS (SELECT 1 FROM catalog.item_tags it JOIN catalog.tags t ON t.id = it.tag_id
          WHERE it.item_id = i.id AND t.slug = ${PLAYABLE_GAME_TAG.slug})
      ORDER BY ia.sort_order, ia.id LIMIT 1`
    if (!rows[0] || rows[0].bucket !== adminStorage().bucket) return missing()
    if (!filePath) {
      const source = new URL(`/api/games/${id}/play/game.swf`, request.url).href
      return new Response(swfPlayerDocument(source), { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } })
    }
    const range = request.headers.get('range') ?? undefined
    if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) return new Response(null, { status: 416, headers })
    const file = await readStoredStream(String(rows[0].object_path), range)
    if (!file.Body) return missing()
    return new Response(file.Body.transformToWebStream(), { status: file.ContentRange ? 206 : 200,
      headers: { ...headers, 'Content-Type': SWF_MIME, 'Content-Disposition': 'inline', 'Accept-Ranges': 'bytes',
        ...(file.ContentLength !== undefined ? { 'Content-Length': String(file.ContentLength) } : {}),
        ...(file.ContentRange ? { 'Content-Range': file.ContentRange } : {}),
      } })
  } catch (error) {
    console.error('[game.playback]', error instanceof Error ? error.message : 'Playback failed')
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
    return new Response('The game could not load. You can still download it.', { status: status === 416 ? 416 : status === 404 ? 404 : 503, headers })
  }
}
