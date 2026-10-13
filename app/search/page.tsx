import type { Metadata } from 'next'
import Archive from './archive'

export const metadata: Metadata = { title: 'Explore the archive | pixinium.' }

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ category?: string; q?: string }> }) {
  const { category, q } = await searchParams
  const initialFilter = category && ['Wallpapers', 'Music', 'Games'].includes(category) ? category : 'All items'
  const query = typeof q === 'string' ? q : ''
  return <Archive key={`${initialFilter}:${query}`} initialFilter={initialFilter} initialQuery={query} />
}
