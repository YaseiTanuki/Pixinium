import { NextResponse } from 'next/server'
import { listCatalogItems, listCategories } from '@/server/services/catalog.service'
export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
 const params = new URL(request.url).searchParams
 const category = params.get('category') || undefined
 const query = params.get('q')?.trim()
 if (query && query.length > 100) return NextResponse.json({ error: 'Search query must be 100 characters or fewer.' }, { status: 400 })
 if (category && !(await listCategories()).some(entry => entry.slug === category)) return NextResponse.json({ error: 'Invalid catalog category.' }, { status: 400 })
 return NextResponse.json({ items: await listCatalogItems({ category, query }) })
}
