import Home from '@/components/home'
import { listArchiveItems } from '@/server/services/archive.service'

export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: { searchParams: Promise<{ collection?: string }> }) {
  const { collection } = await searchParams
  const items = await listArchiveItems()
  return <Home key={collection ?? 'all'} items={items} initialFilter={collection === 'saved' ? 'Saved' : 'All items'} />
}
