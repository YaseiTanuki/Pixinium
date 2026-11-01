'use client'

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import { categoryHref, searchHref } from '@/lib/catalog'
import { SEARCH_SORT_OPTIONS, searchTags, searchCategories, type CatalogFilterValues } from '@/lib/search-filters'
import type { Category, Tag } from '@/lib/entities/catalog'
import { FilterSelect } from './catalog-filters/filter-select'
import { ContentTypeSelect } from './catalog-filters/content-type-select'
import { TagInput } from './catalog-filters/tag-input'

type Props = {
  categories: Pick<Category, 'slug' | 'name'>[]; tags: Tag[]; applied: CatalogFilterValues
  scope?: string; query?: string; pending?: boolean; children: ReactNode
  onApply?: (values: CatalogFilterValues) => void
  search?: { placeholder: string }
  sortOptions?: readonly { value: string; label: string }[]
}

export function CatalogFilters({ categories, tags, applied, scope, query = '', pending: externalPending = false, children, onApply, search, sortOptions = SEARCH_SORT_OPTIONS }: Props) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(applied)
  const [input, setInput] = useState('')
  const [navigating, startTransition] = useTransition()
  const router = useRouter()
  const toggle = useRef<HTMLButtonElement>(null)
  const pending = externalPending || navigating
  const { category, tag, sort, tagMatch, query: filterQuery } = applied
  useEffect(() => {
    setDraft({ category, tag, sort, tagMatch, query: filterQuery })
    setInput('')
  }, [category, tag, sort, tagMatch, filterQuery])
  const activeCategories = scope ? [] : searchCategories(category)
  const activeTags = searchTags(tag)
  const count = activeCategories.length + activeTags.length + Number(Boolean(sort)) + Number(Boolean(search && filterQuery))
  const canClear = count > 0 || Boolean(draft.tag || input || draft.sort || draft.query || (!scope && draft.category))
  const clearValues = { category: scope ?? '', tag: '', sort: '', tagMatch: 'all', ...(search ? { query: '' } : {}) }
  const change = (values: CatalogFilterValues) => {
    setDraft(values)
    setInput('')
    if (onApply) onApply(values)
    else startTransition(() => router.push(scope ? categoryHref(scope, { ...values, query }) : searchHref({ ...values, query }), { scroll: false }))
  }

  return <div className="catalog-filters" data-scope={scope ? 'category' : 'archive'} data-search={search ? 'true' : undefined} aria-busy={pending}>
    <div className="search-filter-toolbar">
      {children}
      <button ref={toggle} type="button" className="search-filter-toggle" aria-expanded={open} aria-controls="search-filters" onClick={() => setOpen(value => !value)}>
        <SlidersHorizontal size={16} aria-hidden="true" /> Filters
        {count > 0 && <span className="search-filter-count" aria-label={`${count} active filters`}>{count}</span>}
        <ChevronDown size={15} aria-hidden="true" />
      </button>
    </div>
    <form id="search-filters" className="search-filter-panel" hidden={!open} onSubmit={event => {
      event.preventDefault()
      change({ ...draft, category: scope ?? draft.category, tag: searchTags(`${draft.tag} ${input}`).join(' ') })
      setOpen(false)
      toggle.current?.focus()
    }}>
      <div className="search-filter-fields">
        {search && <div className="search-filter-field search-filter-query-field"><label className="search-filter-label" htmlFor="collection-filter-query">Search saved finds</label><input id="collection-filter-query" className="collection-filter-query" type="search" value={draft.query ?? ''} disabled={pending} placeholder={search.placeholder} onChange={event => setDraft(value => ({ ...value, query: event.target.value }))} /></div>}
        {!scope && <ContentTypeSelect value={draft.category} onChange={category => setDraft(value => ({ ...value, category }))} disabled={pending} options={[
          ...activeCategories.filter(value => !categories.some(category => category.slug === value)).map(value => ({ value, label: `${value} (unavailable)` })),
          ...categories.map(category => ({ value: category.slug, label: category.name })),
        ]} />}
        <TagInput value={draft.tag} input={input} onChange={tag => setDraft(value => ({ ...value, tag }))} onInputChange={setInput} suggestions={tags} disabled={pending} />
        <div className="search-filter-options">
          <FilterSelect id="search-sort" label="Sort by" value={draft.sort} onChange={sort => setDraft(value => ({ ...value, sort }))} disabled={pending} options={sortOptions} />
          <FilterSelect id="search-tag-match" label="Match tags" value={draft.tagMatch} onChange={tagMatch => setDraft(value => ({ ...value, tagMatch }))} disabled={pending} options={[
            { value: 'all', label: 'All tags' }, { value: 'any', label: 'Any tag' },
          ]} />
        </div>
      </div>
      <div className="search-filter-footer">
        <p>{draft.tagMatch === 'all' ? 'Find items with every selected tag.' : 'Find items with at least one selected tag.'}</p>
        <div className="search-filter-actions">
          <button type="button" className="search-filter-reset" disabled={pending || !canClear} onClick={() => change(clearValues)}>Clear filters</button>
          <button type="submit" className="search-filter-apply" disabled={pending}>{pending ? 'Applying…' : 'Apply filters'}</button>
        </div>
      </div>
    </form>
    {count > 0 && <div className="search-active-filters" aria-label="Active filters">
      {search && filterQuery && <button type="button" disabled={pending} onClick={() => change({ ...applied, query: '' })} aria-label="Remove search filter">Search: {filterQuery}<X size={14} aria-hidden="true" /></button>}
      {activeCategories.map(value => {
        const name = categories.find(option => option.slug === value)?.name ?? value
        return <button key={value} type="button" disabled={pending} onClick={() => change({ ...applied, category: activeCategories.filter(category => category !== value).join(',') })} aria-label={`Remove content type: ${name}`}>Type: {name}<X size={14} aria-hidden="true" /></button>
      })}
      {activeTags.map(value => <button key={value} type="button" disabled={pending} onClick={() => change({ ...applied, tag: activeTags.filter(tag => tag !== value).join(' ') })} aria-label={`Remove tag: ${value}`}>#{tags.find(option => option.slug === value)?.name ?? value}<X size={14} aria-hidden="true" /></button>)}
      {activeTags.length > 1 && <span className="search-tag-hint">Matching {tagMatch === 'any' ? 'any' : 'all'} tags</span>}
      {sort && <button type="button" disabled={pending} onClick={() => change({ ...applied, sort: '' })} aria-label="Remove sorting">{sortOptions.find(option => option.value === sort)?.label}<X size={14} aria-hidden="true" /></button>}
      <button type="button" className="search-clear-all" disabled={pending} onClick={() => change(clearValues)}>Clear all</button>
    </div>}
    {pending && <p role="status" className="search-tag-hint">Updating results…</p>}
  </div>
}
