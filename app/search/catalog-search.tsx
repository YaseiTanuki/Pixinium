'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SiteHeader } from '@/components/site-header'
import { CatalogCard } from '@/components/catalog-card'
import { MasonryGrid } from '@/components/masonry-grid'
import { CategoryNavigation } from '@/components/category-navigation'
import { CATALOG_DISPLAY, searchHref } from '@/lib/catalog'
import { useEffect, useRef, useState, useTransition } from 'react'
import { ArrowLeft, ArrowRight, SearchX } from 'lucide-react'
import type { CatalogDetail, Category } from '@/lib/entities/catalog'

type Props = {
  categories: Category[]
  items: CatalogDetail[]; total: number; page: number; totalPages: number
  initialUse?: string; initialQuery?: string
}

export default function CatalogSearch({ items, categories, total, page, totalPages, initialUse = '', initialQuery = '' }: Props) {
  const [query, setQuery] = useState(initialQuery)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const first = (page - 1) * CATALOG_DISPLAY.archivePageSize + 1
  const pages = [...new Set([1, page - 1, page, page + 1, totalPages])].filter(value => value >= 1 && value <= totalPages).sort((a, b) => a - b)

  useEffect(() => { setQuery(initialQuery) }, [initialQuery])

  useEffect(() => {
    if (query.trim() === initialQuery) return
    searchTimer.current = setTimeout(() => startTransition(() => {
      router.replace(searchHref({ use: initialUse, query: query.trim() }), { scroll: false })
    }), 350)
    return () => clearTimeout(searchTimer.current)
  }, [query, initialQuery, initialUse, router])

  return (
    <main className="home-page archive-page">
      <SiteHeader query={query} onQueryChange={setQuery} searchUse={initialUse} />
      <div className="page-shell catalog-layout">
      <CategoryNavigation categories={categories} current="all" />
      <div className="search-content">
        <div aria-busy={pending}>
          <div className="archive-results-heading">
            <p role="status">{pending ? 'Finding your next favorite…' : items.length ? <><span className="archive-result-dot" aria-hidden="true" /> Showing <strong>{first}–{first + items.length - 1}</strong> of {total} finds</> : 'No treasures found'}</p>
            {items.length > 0 && <span>Page <strong>{page}</strong> of {totalPages}</span>}
          </div>
          <MasonryGrid className="discovery-grid search-all-grid">{items.map(item => <CatalogCard key={item.item.id} item={item} variant="detailed" />)}</MasonryGrid>
          {!items.length && !pending && <div className="archive-empty"><SearchX size={30} aria-hidden="true" /><h2>No finds on this shelf.</h2><p>Try another search or take a look through the whole archive.</p><Link href="/search">Show all finds <ArrowRight size={16} aria-hidden="true" /></Link></div>}
          {totalPages > 1 && <nav className="archive-pagination" aria-label="Archive pages">
            <p className="archive-pagination-summary">Page <strong>{page}</strong> of <strong>{totalPages}</strong></p>
            <div className="archive-pagination-controls">
            {page > 1 ? <Link className="archive-page-step" prefetch={false} href={searchHref({ use: initialUse, query: initialQuery, page: page - 1 })} aria-label="Previous page"><ArrowLeft size={17} aria-hidden="true" /> <span>Previous</span></Link> : <span className="archive-page-step" aria-disabled="true" aria-label="Previous page"><ArrowLeft size={17} aria-hidden="true" /> <span>Previous</span></span>}
            <div className="archive-page-numbers">{pages.map((number, index) => <div key={number}>
              {index > 0 && number - pages[index - 1] > 1 && <span aria-hidden="true">…</span>}
              <Link prefetch={false} href={searchHref({ use: initialUse, query: initialQuery, page: number })} aria-label={`Page ${number}`} aria-current={number === page ? 'page' : undefined}>{number}</Link>
            </div>)}</div>
            {page < totalPages ? <Link className="archive-page-step" prefetch={false} href={searchHref({ use: initialUse, query: initialQuery, page: page + 1 })} aria-label="Next page"><span>Next</span> <ArrowRight size={17} aria-hidden="true" /></Link> : <span className="archive-page-step" aria-disabled="true" aria-label="Next page"><span>Next</span> <ArrowRight size={17} aria-hidden="true" /></span>}
            </div>
          </nav>}
        </div>
      </div>
      </div>
    </main>
  )
}
