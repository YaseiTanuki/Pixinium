import { NextResponse } from 'next/server'
import { isArchiveCategory } from '@/lib/archive'
import { listArchiveItems } from '@/server/services/archive.service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams
  const categoryParam = searchParams.get('category')
  const query = searchParams.get('q')?.trim()
  const category = categoryParam && isArchiveCategory(categoryParam) ? categoryParam : undefined

  if (categoryParam && !category) {
    return NextResponse.json({ error: 'Invalid archive category.' }, { status: 400 })
  }

  if (query && query.length > 100) {
    return NextResponse.json({ error: 'Search query must be 100 characters or fewer.' }, { status: 400 })
  }

  const items = await listArchiveItems({
    category,
    ...(query ? { query } : {}),
  })

  return NextResponse.json({ items })
}
