import type { Metadata } from 'next'
import { cache } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, Search, SearchX } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { BrandLogo } from '@/components/brand-logo'
import { CategoryNavigation } from '@/components/category-navigation'
import { CategoryResults } from '@/components/category/category-results'
import { CatalogFilters } from '@/components/catalog-filters'
import { searchTags, searchSort } from '@/lib/search-filters'
import { CATALOG_DISPLAY, categoryHref } from '@/lib/catalog'
import { categoryIcon } from '@/lib/category-icons'
import { contentKind } from '@/lib/content-types'
import { listArchivePage, listCategories, listArchiveTags } from '@/server/services/catalog.service'
import '../search/search.css'
import '../categories/category.css'
import '@/components/category/asset-folder-card.css'
import { breadcrumbData, pageMetadata } from '@/lib/seo'
import { JsonLd } from '@/components/json-ld'

export const dynamic = 'force-dynamic'
type Props = { params: Promise<{ category: string }>; searchParams: Promise<{ q?: string | string[]; page?: string | string[]; tag?: string | string[]; sort?: string | string[]; match?: string | string[] }> }

const loadCategoryArchive = cache((slug: string, query: string, tag: string, sort: string, tagMatch: string, page: number) => listArchivePage({ category: slug, query, tag, sort, tagMatch, page }))

function categoryFilters(search: Awaited<Props['searchParams']>) {
  return {
    query: typeof search.q === 'string' ? search.q.trim() : '',
    tag: searchTags(Array.isArray(search.tag) ? search.tag.join(' ') : search.tag ?? '').join(' '),
    sort: searchSort(typeof search.sort === 'string' ? search.sort : ''),
    tagMatch: search.match === 'any' ? 'any' : 'all',
    requestedPage: typeof search.page === 'string' && /^\d+$/.test(search.page) ? Number(search.page) : 1,
  }
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { category: slug } = await params
  const category = (await listCategories()).find(entry => entry.slug === slug)
  if (!category) notFound()
  const search = await searchParams
  const { query, tag, sort, tagMatch, requestedPage } = categoryFilters(search)
  const { page } = await loadCategoryArchive(slug, query, tag, sort, tagMatch, requestedPage)
  const filtered = [search.q, search.tag, search.sort].some(value => Array.isArray(value) ? value.some(entry => entry.trim()) : value?.trim())
  return pageMetadata({ title: `${category.name}${page > 1 ? ` — Page ${page}` : ''}`, description: category.description || `Explore curated ${category.name.toLowerCase()} in the Pixinium archive.`, path: categoryHref(slug, { page }), index: !filtered })
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ category: slug }, search, categories] = await Promise.all([params, searchParams, listCategories()])
  const category = categories.find(entry => entry.slug === slug)
  if (!category) notFound()
  const { query, tag, sort, tagMatch, requestedPage } = categoryFilters(search)
  const filtered = Boolean(query || tag || sort)
  const [{ items, total, page, totalPages }, tags] = await Promise.all([
    loadCategoryArchive(slug, query, tag, sort, tagMatch, requestedPage), listArchiveTags(),
  ])
  const Icon = categoryIcon(category.iconKey)
  const kind = contentKind(category.metadataSchemaKey)
  const first = (page - 1) * CATALOG_DISPLAY.archivePageSize + 1
  const pages = [...new Set([1, page - 1, page, page + 1, totalPages])].filter(value => value >= 1 && value <= totalPages).sort((a, b) => a - b)
  const href = (number: number) => categoryHref(slug, { query, tag, sort, tagMatch, page: number })
  return <div className="home-page category-page" data-kind={kind}>
    <a className="skip-home" href="#category-content">Skip to content</a>
    <SiteHeader searchCategory={slug} searchTag={tag} searchSort={sort} searchTagMatch={tagMatch} />
    <div className="page-shell catalog-layout">
    <CategoryNavigation categories={categories} current={slug} />
    <main id="category-content">
      <JsonLd value={breadcrumbData([{ name: 'Home', path: '/' }, { name: category.name, path: categoryHref(slug) }])} />
      <header className="category-banner">
        <div><p className="eyebrow">THE PIXINIUM COLLECTION</p><h1><Icon size={36} aria-hidden="true" />{category.name}<span>.</span></h1><p className="category-description">{category.description}</p></div>
        <div className="category-banner-mark" aria-hidden="true">{kind === 'music' ? <div className="record-disc"><span /></div> : <Icon strokeWidth={1} />}</div>
      </header>
      <CatalogFilters categories={categories} tags={tags} scope={slug} query={query} applied={{ category: slug, tag, sort, tagMatch }}>
      <div className="category-toolbar">
        <div><h2>{query ? `Results for “${query}”` : `Explore ${category.name.toLowerCase()}`}</h2><p>{total.toLocaleString('en')} {total === 1 ? 'find' : 'finds'}{items.length > 0 && ` · Showing ${first}–${first + items.length - 1}`}</p></div>
        <form action={categoryHref(slug)} method="get" role="search" className="category-search">
          {tag && <input type="hidden" name="tag" value={tag} />}
          {sort && <input type="hidden" name="sort" value={sort} />}
          {tag && tagMatch === 'any' && <input type="hidden" name="match" value="any" />}
          <Search size={17} aria-hidden="true" /><input key={query} type="search" name="q" defaultValue={query} aria-label={`Search ${category.name}`} placeholder={`Search ${category.name.toLowerCase()}…`} /><button type="submit" aria-label={`Search ${category.name}`}><ArrowRight size={18} aria-hidden="true" /></button>
        </form>
      </div>
      </CatalogFilters>
      {items.length ? <CategoryResults items={items} schemaKey={category.metadataSchemaKey} /> : <div className="archive-empty"><SearchX size={30} aria-hidden="true" /><h2>{filtered ? 'No finds match these filters.' : 'Good things are on their way.'}</h2><p>{filtered ? 'Try another search or clear the filters in this collection.' : 'Check back for new additions to this collection.'}</p><Link href={filtered ? categoryHref(slug) : '/search'}>{filtered ? `Browse all ${category.name.toLowerCase()}` : 'Explore all finds'}<ArrowRight size={16} aria-hidden="true" /></Link></div>}
      {totalPages > 1 && <nav className="archive-pagination" aria-label={`${category.name} pages`}>
        <p className="archive-pagination-summary">Page <strong>{page}</strong> of <strong>{totalPages}</strong></p>
        <div className="archive-pagination-controls">
          {page > 1 ? <Link className="archive-page-step" href={href(page - 1)} prefetch={false} aria-label="Previous page"><ArrowLeft size={17} /><span>Previous</span></Link> : <span className="archive-page-step" aria-disabled="true" aria-label="Previous page"><ArrowLeft size={17} /><span>Previous</span></span>}
          <div className="archive-page-numbers">{pages.map((number, index) => <div key={number}>{index > 0 && number - pages[index - 1] > 1 && <span aria-hidden="true">…</span>}<Link href={href(number)} prefetch={false} aria-current={number === page ? 'page' : undefined} aria-label={`Page ${number}`}>{number}</Link></div>)}</div>
          {page < totalPages ? <Link className="archive-page-step" href={href(page + 1)} prefetch={false} aria-label="Next page"><span>Next</span><ArrowRight size={17} /></Link> : <span className="archive-page-step" aria-disabled="true" aria-label="Next page"><span>Next</span><ArrowRight size={17} /></span>}
        </div>
      </nav>}
    </main>
    </div>
    <footer className="home-footer page-shell"><BrandLogo className="brand-logo-footer" /><p>A little archive. A lot to love.</p><Link href="/">Back to home ↑</Link></footer>
  </div>
}
