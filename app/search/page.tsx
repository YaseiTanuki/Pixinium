import CatalogSearch from './catalog-search'
import './search.css'
import { searchTags, searchSort, searchCategories } from '@/lib/search-filters'
import { listArchivePage, listArchiveTags, listCategories } from '@/server/services/catalog.service'
import { pageMetadata } from '@/lib/seo'
export const metadata = pageMetadata({ title: 'Search the archive', description: 'Search Pixinium by content type and tags to find wallpapers, music, games and creative assets.', path: '/search', index: false })
export const dynamic = 'force-dynamic'
export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string | string[]; tag?: string | string[]; category?: string | string[]; page?: string | string[]; sort?: string | string[]; match?: string | string[] }> }) {
 const params = await searchParams
 const q = typeof params.q === 'string' ? params.q.trim() : ''
 const tag = searchTags(Array.isArray(params.tag) ? params.tag.join(' ') : params.tag ?? '').join(' ')
 const sort = searchSort(typeof params.sort === 'string' ? params.sort : '')
 const tagMatch = params.match === 'any' ? 'any' : 'all'
 const category = searchCategories(Array.isArray(params.category) ? params.category.join(',') : params.category ?? '').join(',')
 const requestedPage = typeof params.page === 'string' && /^\d+$/.test(params.page) ? Number(params.page) : 1
 const [result, categories, tags] = await Promise.all([listArchivePage({ query: q, tag, category, sort, tagMatch, page: requestedPage }), listCategories(), listArchiveTags()])
 return <CatalogSearch {...result} categories={categories} tags={tags} initialTag={tag} initialCategory={category} initialQuery={q} initialSort={sort} initialTagMatch={tagMatch} />
}
