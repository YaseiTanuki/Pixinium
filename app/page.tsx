import Home from '@/components/home'
import { listArchiveItems } from '@/server/services/archive.service'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const items = await listArchiveItems()
  return <Home items={items} />
}
