'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SiteHeader } from '@/components/site-header'
import { CatalogCard } from '@/components/catalog-card'
import { MasonryGrid } from '@/components/masonry-grid'
import { CategoryNavigation } from '@/components/category-navigation'
import { CATALOG_DISPLAY, searchHref } from '@/lib/catalog'
import { useEffect, useRef, useState, useTransition } from 'react'
import { ArrowLeft, ArrowRight, ChevronDown, SearchX, SlidersHorizontal, X } from 'lucide-react'
import type { CatalogDetail, Category, Tag } from '@/lib/entities/catalog'
import { SEARCH_SORT_OPTIONS, searchTags, searchCategories } from '@/lib/search-filters'
import { FilterSelect } from './filter-select'
import { TagInput } from './tag-input'
import { ContentTypeSelect } from './content-type-select'

type Props = {
  categories: Category[]
  tags: Tag[]
  items: CatalogDetail[]; total: number; page: number; totalPages: number
  initialTag?: string; initialCategory?: string; initialQuery?: string; initialSort?: string; initialTagMatch?: string
}

export default function CatalogSearch({ items, categories, tags, total, page, totalPages, initialTag = '', initialCategory = '', initialQuery = '', initialSort = '', initialTagMatch = 'all' }: Props) {
  const [query, setQuery] = useState(initialQuery)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [draftCategory, setDraftCategory] = useState(initialCategory)
  const [draftTag, setDraftTag] = useState(initialTag)
  const [tagInput, setTagInput] = useState('')
  const [draftSort, setDraftSort] = useState(initialSort)
  const [draftTagMatch, setDraftTagMatch] = useState(initialTagMatch)
  const filterButton = useRef<HTMLButtonElement>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const first = (page - 1) * CATALOG_DISPLAY.archivePageSize + 1
  const pages = [...new Set([1, page - 1, page, page + 1, totalPages])].filter(value => value >= 1 && value <= totalPages).sort((a, b) => a - b)

  useEffect(() => { setQuery(initialQuery) }, [initialQuery])
  useEffect(() => {
    setDraftCategory(initialCategory)
    setDraftTag(initialTag)
    setTagInput('')
    setDraftSort(initialSort)
    setDraftTagMatch(initialTagMatch)
  }, [initialCategory, initialTag, initialSort, initialTagMatch])

  const activeTags = searchTags(initialTag)
  const activeCategories = searchCategories(initialCategory)
  const filterCount = activeCategories.length + activeTags.length + Number(Boolean(initialSort))
  const changeFilters = (category: string, tag: string, sort = initialSort, tagMatch = initialTagMatch) => {
    clearTimeout(searchTimer.current)
    setDraftCategory(category)
    setDraftTag(tag)
    setTagInput('')
    setDraftSort(sort)
    setDraftTagMatch(tagMatch)
    startTransition(() => router.push(searchHref({ category, tag, sort, tagMatch, query: query.trim() }), { scroll: false }))
  }

  useEffect(() => {
    if (query.trim() === initialQuery) return
    searchTimer.current = setTimeout(() => startTransition(() => {
      router.replace(searchHref({ category: initialCategory, tag: initialTag, sort: initialSort, tagMatch: initialTagMatch, query: query.trim() }), { scroll: false })
    }), 350)
    return () => clearTimeout(searchTimer.current)
  }, [query, initialQuery, initialTag, initialCategory, initialSort, initialTagMatch, router])

  return (
    <main className="home-page archive-page">
      <SiteHeader query={query} onQueryChange={setQuery} searchTag={initialTag} searchCategory={initialCategory} searchSort={initialSort} searchTagMatch={initialTagMatch} />
      <div className="page-shell catalog-layout">
      <CategoryNavigation categories={categories} current="all" />
      <div className="search-content">
        <div className="search-filter-toolbar">
          <h1>Explore the archive</h1>
          <button ref={filterButton} type="button" className="search-filter-toggle" aria-expanded={filtersOpen} aria-controls="search-filters" onClick={() => setFiltersOpen(open => !open)}>
            <SlidersHorizontal size={16} aria-hidden="true" /> Filters
            {filterCount > 0 && <span className="search-filter-count" aria-label={`${filterCount} active filters`}>{filterCount}</span>}
            <ChevronDown size={15} aria-hidden="true" />
          </button>
        </div>
        <form id="search-filters" className="search-filter-panel" hidden={!filtersOpen} onSubmit={event => {
          event.preventDefault()
          changeFilters(draftCategory, searchTags(`${draftTag} ${tagInput}`).join(' '), draftSort, draftTagMatch)
          setFiltersOpen(false)
          filterButton.current?.focus()
        }}>
          <div className="search-filter-fields">
            <ContentTypeSelect value={draftCategory} onChange={setDraftCategory} disabled={pending} options={[
              ...activeCategories.filter(value => !categories.some(category => category.slug === value)).map(value => ({ value, label: `${value} (unavailable)` })),
              ...categories.map(category => ({ value: category.slug, label: category.name })),
            ]} />
            <TagInput value={draftTag} input={tagInput} onChange={setDraftTag} onInputChange={setTagInput} suggestions={tags} disabled={pending} />
            <div className="search-filter-options">
              <FilterSelect id="search-sort" label="Sort by" value={draftSort} onChange={setDraftSort} disabled={pending} options={SEARCH_SORT_OPTIONS} />
              <FilterSelect id="search-tag-match" label="Match tags" value={draftTagMatch} onChange={setDraftTagMatch} disabled={pending} options={[
                { value: 'all', label: 'All tags' }, { value: 'any', label: 'Any tag' },
              ]} />
            </div>
          </div>
          <div className="search-filter-footer">
            <p>{draftTagMatch === 'all' ? 'Find items with every selected tag.' : 'Find items with at least one selected tag.'}</p>
            <div className="search-filter-actions">
              <button type="button" className="search-filter-reset" disabled={pending || (!draftCategory && !draftTag && !tagInput && !draftSort && !filterCount)} onClick={() => changeFilters('', '', '', 'all')}>Clear filters</button>
              <button type="submit" className="search-filter-apply" disabled={pending}>{pending ? 'Applying…' : 'Apply filters'}</button>
            </div>
          </div>
        </form>
        {filterCount > 0 && <div className="search-active-filters" aria-label="Active filters">
          {activeCategories.map(category => {
            const name = categories.find(option => option.slug === category)?.name ?? category
            return <button key={category} type="button" disabled={pending} onClick={() => changeFilters(activeCategories.filter(value => value !== category).join(','), initialTag)} aria-label={`Remove content type: ${name}`}>Type: {name}<X size={14} aria-hidden="true" /></button>
          })}
          {activeTags.map(tag => <button key={tag} type="button" disabled={pending} onClick={() => changeFilters(initialCategory, activeTags.filter(value => value !== tag).join(' '))} aria-label={`Remove tag: ${tag}`}>#{tags.find(option => option.slug === tag)?.name ?? tag}<X size={14} aria-hidden="true" /></button>)}
          {activeTags.length > 1 && <span className="search-tag-hint">Matching {initialTagMatch === 'any' ? 'any' : 'all'} tags</span>}
          {initialSort && <button type="button" disabled={pending} onClick={() => changeFilters(initialCategory, initialTag, '')} aria-label="Remove sorting">{SEARCH_SORT_OPTIONS.find(option => option.value === initialSort)?.label}<X size={14} aria-hidden="true" /></button>}
          <button type="button" className="search-clear-all" disabled={pending} onClick={() => changeFilters('', '', '', 'all')}>Clear all</button>
        </div>}
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
            {page > 1 ? <Link className="archive-page-step" prefetch={false} href={searchHref({ category: initialCategory, tag: initialTag, sort: initialSort, tagMatch: initialTagMatch, query: initialQuery, page: page - 1 })} aria-label="Previous page"><ArrowLeft size={17} aria-hidden="true" /> <span>Previous</span></Link> : <span className="archive-page-step" aria-disabled="true" aria-label="Previous page"><ArrowLeft size={17} aria-hidden="true" /> <span>Previous</span></span>}
            <div className="archive-page-numbers">{pages.map((number, index) => <div key={number}>
              {index > 0 && number - pages[index - 1] > 1 && <span aria-hidden="true">…</span>}
              <Link prefetch={false} href={searchHref({ category: initialCategory, tag: initialTag, sort: initialSort, tagMatch: initialTagMatch, query: initialQuery, page: number })} aria-label={`Page ${number}`} aria-current={number === page ? 'page' : undefined}>{number}</Link>
            </div>)}</div>
            {page < totalPages ? <Link className="archive-page-step" prefetch={false} href={searchHref({ category: initialCategory, tag: initialTag, sort: initialSort, tagMatch: initialTagMatch, query: initialQuery, page: page + 1 })} aria-label="Next page"><span>Next</span> <ArrowRight size={17} aria-hidden="true" /></Link> : <span className="archive-page-step" aria-disabled="true" aria-label="Next page"><span>Next</span> <ArrowRight size={17} aria-hidden="true" /></span>}
            </div>
          </nav>}
        </div>
      </div>
      </div>
    </main>
  )
}
