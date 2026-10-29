import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, Search, SearchX } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { BrandLogo } from '@/components/brand-logo'
import { CategoryNavigation } from '@/components/category-navigation'
import { CategoryResults } from '@/components/category/category-results'
import { CATALOG_DISPLAY, categoryHref } from '@/lib/catalog'
import { categoryIcon } from '@/lib/category-icons'
import { contentKind } from '@/lib/content-types'
import { listArchivePage, listCategories } from '@/server/services/catalog.service'
import '../search/search.css'
import '../categories/category.css'

export const dynamic = 'force-dynamic'
type Props = { params: Promise<{ category: string }>; searchParams: Promise<{ q?: string | string[]; page?: string | string[] }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category: slug } = await params
  const category = (await listCategories()).find(entry => entry.slug === slug)
  return { title: category ? `${category.name} — Pixinium` : 'Category not found — Pixinium', description: category?.description }
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ category: slug }, search, categories] = await Promise.all([params, searchParams, listCategories()])
  const category = categories.find(entry => entry.slug === slug)
  if (!category) notFound()
  const query = typeof search.q === 'string' ? search.q.trim() : ''
  const requestedPage = typeof search.page === 'string' && /^\d+$/.test(search.page) ? Number(search.page) : 1
  const { items, total, page, totalPages } = await listArchivePage({ category: slug, query, page: requestedPage })
  const Icon = categoryIcon(category.iconKey)
  const kind = contentKind(category.metadataSchemaKey)
  const first = (page - 1) * CATALOG_DISPLAY.archivePageSize + 1
  const pages = [...new Set([1, page - 1, page, page + 1, totalPages])].filter(value => value >= 1 && value <= totalPages).sort((a, b) => a - b)
  const href = (number: number) => categoryHref(slug, { query, page: number })
  return <div className="home-page category-page" data-kind={kind}>
    <a className="skip-home" href="#category-content">Skip to content</a>
    <SiteHeader />
    <div className="page-shell"><CategoryNavigation categories={categories} current={slug} /></div>
    <main className="page-shell" id="category-content">
      <header className="category-banner">
        <div><p className="eyebrow">THE PIXINIUM COLLECTION</p><h1><Icon size={36} aria-hidden="true" />{category.name}<span>.</span></h1><p className="category-description">{category.description}</p></div>
        <div className="category-banner-mark" aria-hidden="true"><Icon strokeWidth={1} /></div>
      </header>
      <div className="category-toolbar">
        <div><h2>{query ? `Results for “${query}”` : `Explore ${category.name.toLowerCase()}`}</h2><p>{total.toLocaleString('en')} {total === 1 ? 'find' : 'finds'}{items.length > 0 && ` · Showing ${first}–${first + items.length - 1}`}</p></div>
        <form action={categoryHref(slug)} method="get" role="search" className="category-search">
          <Search size={17} aria-hidden="true" /><input key={query} type="search" name="q" defaultValue={query} aria-label={`Search ${category.name}`} placeholder={`Search ${category.name.toLowerCase()}…`} /><button type="submit" aria-label={`Search ${category.name}`}><ArrowRight size={18} aria-hidden="true" /></button>
        </form>
      </div>
      {items.length ? <CategoryResults items={items} schemaKey={category.metadataSchemaKey} /> : <div className="archive-empty"><SearchX size={30} aria-hidden="true" /><h2>{query ? 'No finds match this search.' : 'Good things are on their way.'}</h2><p>{query ? 'Try another search in this collection.' : 'Check back for new additions to this collection.'}</p><Link href={query ? categoryHref(slug) : '/search'}>{query ? `Browse all ${category.name.toLowerCase()}` : 'Explore all finds'}<ArrowRight size={16} aria-hidden="true" /></Link></div>}
      {totalPages > 1 && <nav className="archive-pagination" aria-label={`${category.name} pages`}>
        <p className="archive-pagination-summary">Page <strong>{page}</strong> of <strong>{totalPages}</strong></p>
        <div className="archive-pagination-controls">
          {page > 1 ? <Link className="archive-page-step" href={href(page - 1)} prefetch={false} aria-label="Previous page"><ArrowLeft size={17} /><span>Previous</span></Link> : <span className="archive-page-step" aria-disabled="true" aria-label="Previous page"><ArrowLeft size={17} /><span>Previous</span></span>}
          <div className="archive-page-numbers">{pages.map((number, index) => <div key={number}>{index > 0 && number - pages[index - 1] > 1 && <span aria-hidden="true">…</span>}<Link href={href(number)} prefetch={false} aria-current={number === page ? 'page' : undefined} aria-label={`Page ${number}`}>{number}</Link></div>)}</div>
          {page < totalPages ? <Link className="archive-page-step" href={href(page + 1)} prefetch={false} aria-label="Next page"><span>Next</span><ArrowRight size={17} /></Link> : <span className="archive-page-step" aria-disabled="true" aria-label="Next page"><span>Next</span><ArrowRight size={17} /></span>}
        </div>
      </nav>}
    </main>
    <footer className="home-footer page-shell"><BrandLogo className="brand-logo-footer" /><p>A little archive. A lot to love.</p><Link href="/">Back to home ↑</Link></footer>
  </div>
}
