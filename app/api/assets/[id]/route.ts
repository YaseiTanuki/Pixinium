import { neon } from '@neondatabase/serverless'
import { NextResponse } from 'next/server'
import { adminStorage } from '@/server/services/storage.service'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }
  const { id } = await params
  if (!/^[1-9][0-9]{0,18}$/.test(id)) return new NextResponse(null, { status: 404, headers })
  try {
    if (!process.env.DATABASE_URL) throw new Error('Catalog unavailable')
    const sql = neon(process.env.DATABASE_URL)
    const rows = await sql`SELECT a.bucket, a.object_path, bool_or(ia.role = 'download') AS download
      FROM catalog.assets a JOIN catalog.item_assets ia ON ia.asset_id = a.id
      JOIN catalog.items i ON i.id = ia.item_id JOIN catalog.categories c ON c.id = i.category_id
      WHERE a.id = ${id}::bigint AND a.provider = 'supabase' AND i.status = 'published' AND c.is_active
      GROUP BY a.id, a.bucket, a.object_path`
    if (!rows[0]) return new NextResponse(null, { status: 404, headers })
    const { storage, bucket } = adminStorage()
    if (rows[0].bucket !== bucket) return new NextResponse(null, { status: 404, headers })
    const { data, error } = await storage.from(bucket).createSignedUrl(String(rows[0].object_path), 60, { download: Boolean(rows[0].download) })
    if (error || !data) return new NextResponse(null, { status: 503, headers })
    return new NextResponse(null, { status: 307, headers: { ...headers, Location: data.signedUrl } })
  } catch { return new NextResponse(null, { status: 503, headers }) }
}
