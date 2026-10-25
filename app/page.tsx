import Home from '@/components/home'
import { listCatalogItems, listCategories, listContentUses } from '@/server/services/catalog.service'
export const dynamic = 'force-dynamic'
export default async function Page({ searchParams }: { searchParams: Promise<{ collection?: string }> }) {
 const { collection } = await searchParams
 const [items, categories, uses] = await Promise.all([listCatalogItems(), listCategories(), listContentUses()])
 return <Home key={collection ?? ''} items={items} categories={categories} uses={uses} initialFilter={collection === 'saved' ? 'saved' : ''} />
}
