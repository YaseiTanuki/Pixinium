import CatalogSearch from './catalog-search'
import './search.css'
import { listArchivePage, listCategories } from '@/server/services/catalog.service'
export const dynamic = 'force-dynamic'
export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string | string[]; use?: string | string[]; page?: string | string[] }> }) {
 const params = await searchParams
 const q = typeof params.q === 'string' ? params.q.trim() : ''
 const use = typeof params.use === 'string' ? params.use : ''
 const requestedPage = typeof params.page === 'string' && /^\d+$/.test(params.page) ? Number(params.page) : 1
 const [result, categories] = await Promise.all([listArchivePage({ query: q, use, page: requestedPage }), listCategories()])
 return <CatalogSearch {...result} categories={categories} initialUse={use} initialQuery={q} />
}
