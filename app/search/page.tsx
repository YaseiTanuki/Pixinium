import type { Metadata } from 'next'
import { isArchiveCategory } from '@/lib/archive'
import { listArchiveItems } from '@/server/services/archive.service'
import Archive from './archive'

export const metadata: Metadata = { title: 'Explore the archive | pixinium.' }
export const dynamic = 'force-dynamic'

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ category?: string; q?: string }> }) {
  const { category, q } = await searchParams
  const initialFilter = category && isArchiveCategory(category) ? category : 'All items'
  const query = typeof q === 'string' ? q : ''
  const items = await listArchiveItems()
  return <Archive key={`${initialFilter}:${query}`} items={items} initialFilter={initialFilter} initialQuery={query} />
}
