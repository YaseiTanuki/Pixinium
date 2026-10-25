import { NextResponse } from 'next/server'
import { discardContentUploads } from '@/app/actions/content'

export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' }
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403, headers })
  }
  try {
    const text = await request.text()
    if (text.length > 4096) return new NextResponse(null, { status: 413, headers })
    const result = await discardContentUploads(JSON.parse(text))
    return NextResponse.json(result, { status: result.error ? 400 : 200, headers })
  } catch { return new NextResponse(null, { status: 400, headers }) }
}
