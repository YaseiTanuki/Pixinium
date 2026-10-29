'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SiteHeader } from '@/components/site-header'
import { CatalogCard } from '@/components/catalog-card'
import { MasonryGrid } from '@/components/masonry-grid'
import { CategoryNavigation } from '@/components/category-navigation'
import { CATALOG_DISPLAY, searchHref } from '@/lib/catalog'
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Gamepad2, Grid2X2, Image, Layers, Monitor, Music2, SearchX, Smartphone, Sparkles, UserRound, type LucideIcon } from 'lucide-react'
import type { CatalogDetail, Category, ContentUse } from '@/lib/entities/catalog'

const filterIcons: Record<string, LucideIcon> = {
  images: Image, wallpaper: Smartphone, background: Monitor,
  avatar: UserRound, music: Music2, games: Gamepad2, assets: Layers,
}

type Props = {
  categories: Category[]
  items: CatalogDetail[]; uses: ContentUse[]; total: number; page: number; totalPages: number
  initialUse?: string; initialQuery?: string
}

export default function CatalogSearch({ items, categories, uses, total, page, totalPages, initialUse = '', initialQuery = '' }: Props) {
  const [query, setQuery] = useState(initialQuery)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const filterTrack = useRef<HTMLDivElement>(null)
  const filterMarker = useRef<HTMLSpanElement>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const filters = [{ slug: '', name: 'All' }, ...uses]
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

  useLayoutEffect(() => {
    const track = filterTrack.current
    const marker = filterMarker.current
    if (!track || !marker) return
    const update = () => {
      const selected = track.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
      marker.style.opacity = selected ? '1' : '0'
      if (!selected) return
      marker.style.left = `${selected.offsetLeft + 12}px`
      marker.style.width = `${selected.offsetWidth - 24}px`
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(track)
    for (const button of track.querySelectorAll('button')) observer.observe(button)
    return () => observer.disconnect()
  }, [initialUse, uses])

  return (
    <main className="home-page archive-page">
      <SiteHeader query={query} onQueryChange={setQuery} searchUse={initialUse} />
      <div className="page-shell"><CategoryNavigation categories={categories} current="all" /></div>
      <div className="page-shell search-content">
        <header className="archive-intro">
          <div><p className="archive-kicker"><BookOpen size={15} aria-hidden="true" /> The Pixinium archive</p>
            <h1>Your little treasure pile<span>.</span></h1>
            <p className="archive-intro-copy">A fresh screen, a good soundtrack, a tiny escape. Find your next little favorite.</p>
          </div>
          <div className="archive-count"><Sparkles size={19} aria-hidden="true" /><span><strong>{total.toLocaleString('en')}</strong> finds to explore</span></div>
        </header>
        <div className="search-filter-scroll" role="group" aria-label="Filter by use">
          <div className="search-filter-track" ref={filterTrack}>
            {filters.map(({ slug, name }) => {
              const Icon = slug === '' ? Sparkles : filterIcons[slug] ?? Grid2X2
              return <button key={slug} type="button" disabled={pending} onClick={() => { clearTimeout(searchTimer.current); startTransition(() => router.push(searchHref({ use: slug, query: query.trim() }), { scroll: false })) }} aria-pressed={initialUse === slug} className="search-filter-tab">
                <Icon size={17} strokeWidth={1.7} aria-hidden="true" /><span>{name}</span>
              </button>
            })}
            <span className="search-filter-marker" ref={filterMarker} aria-hidden="true" />
          </div>
        </div>
        <div aria-busy={pending}>
          <div className="archive-results-heading">
            <p role="status">{pending ? 'Finding your next favorite…' : items.length ? <><span className="archive-result-dot" aria-hidden="true" /> Showing <strong>{first}–{first + items.length - 1}</strong> of {total} finds</> : 'No treasures found'}</p>
            {items.length > 0 && <span>Page <strong>{page}</strong> of {totalPages}</span>}
          </div>
          <MasonryGrid className="search-results mt-2">{items.map(item => <CatalogCard key={item.item.id} item={item} />)}</MasonryGrid>
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
    </main>
  )
}
