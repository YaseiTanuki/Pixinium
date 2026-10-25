import CatalogSearch from './catalog-search'
import './search.css'
import { listCatalogItems, listContentUses } from '@/server/services/catalog.service'
export const dynamic = 'force-dynamic'
export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; use?: string }> }) {
 const { q, use } = await searchParams
 const [items, uses] = await Promise.all([listCatalogItems(), listContentUses()])
 return <CatalogSearch key={`${q}:${use}`} items={items} uses={uses} initialUse={use ?? ''} initialQuery={q ?? ''} />
}
