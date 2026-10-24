import CatalogSearch from './catalog-search'
import { listCatalogItems, listCategories } from '@/server/services/catalog.service'
export const dynamic = 'force-dynamic'
export default async function Page({ searchParams }: { searchParams: Promise<{ category?: string; q?: string }> }) {
 const { category, q } = await searchParams
 const [items, categories] = await Promise.all([listCatalogItems(), listCategories()])
 return <CatalogSearch key={`${category}:${q}`} items={items} categories={categories} initialFilter={category ?? ''} initialQuery={q ?? ''} />
}
