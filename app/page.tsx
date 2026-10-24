import Home from '@/components/home'
import { listCatalogItems, listCategories } from '@/server/services/catalog.service'
export const dynamic = 'force-dynamic'
export default async function Page({ searchParams }: { searchParams: Promise<{ collection?: string }> }) {
 const { collection } = await searchParams
 const [items, categories] = await Promise.all([listCatalogItems(), listCategories()])
 return <Home key={collection ?? ''} items={items} categories={categories} initialFilter={collection === 'saved' ? 'saved' : ''} />
}
