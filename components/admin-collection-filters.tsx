'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import { ContentTypeSelect } from './catalog-filters/content-type-select'
import { FilterSelect } from './catalog-filters/filter-select'
import { TagInput } from './catalog-filters/tag-input'
import { searchCategories, searchTags } from '@/lib/search-filters'
import { ADMIN_SORT_OPTIONS, EMPTY_ADMIN_FILTERS, adminCatalogHref, type AdminCatalogFilters } from '@/lib/admin/catalog-filters'
import type { Tag } from '@/lib/entities/catalog'
import styles from './admin-studio.module.css'

export function AdminCollectionFilters({ applied, categories, tags, total }: {
  applied: AdminCatalogFilters; categories: { id: string; slug: string; name: string }[]; tags: Tag[]; total: number
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(applied)
  const [input, setInput] = useState('')
  const [pending, startTransition] = useTransition()
  const toggle = useRef<HTMLButtonElement>(null)
  const router = useRouter()
  useEffect(() => { setDraft(applied); setInput('') }, [applied])
  const change = (filters: AdminCatalogFilters) => {
    setDraft(filters)
    setInput('')
    startTransition(() => router.push(adminCatalogHref(filters), { scroll: false }))
  }
  const chips = [
    ...(applied.query ? [{ key: 'query', label: `Search: ${applied.query}`, values: { ...applied, query: '' } }] : []),
    ...searchCategories(applied.category).map(category => ({ key: `category-${category}`, label: categories.find(option => option.slug === category)?.name ?? category, values: { ...applied, category: searchCategories(applied.category).filter(value => value !== category).join(',') } })),
    ...searchTags(applied.tag).map(tag => ({ key: `tag-${tag}`, label: `#${tags.find(option => option.slug === tag)?.name ?? tag}`, values: { ...applied, tag: searchTags(applied.tag).filter(value => value !== tag).join(' ') } })),
    ...(applied.sort ? [{ key: 'sort', label: ADMIN_SORT_OPTIONS.find(option => option.value === applied.sort)?.label ?? applied.sort, values: { ...applied, sort: '' } }] : []),
  ]
  return <div className={styles.filters} aria-busy={pending}>
    <div className="search-filter-toolbar">
      <div><h2>{applied.status === 'draft' ? 'Awaiting review' : applied.status === 'published' ? 'Published content' : 'Content library'}</h2><p role="status">{pending ? 'Updating collection…' : `${total.toLocaleString('en')} ${total === 1 ? 'item' : 'items'} in this view`}</p></div>
      <button ref={toggle} type="button" className="search-filter-toggle" aria-controls="admin-collection-filter-panel" aria-expanded={open} onClick={() => setOpen(value => !value)}><SlidersHorizontal size={16} aria-hidden="true" />Filters{chips.length > 0 && <span className="search-filter-count">{chips.length}<span className="sr-only"> active filters</span></span>}<ChevronDown size={15} aria-hidden="true" /></button>
    </div>
    <form id="admin-collection-filter-panel" className="search-filter-panel" hidden={!open} onSubmit={event => {
      event.preventDefault()
      change({ ...draft, query: draft.query.trim(), tag: searchTags(`${draft.tag} ${input}`).join(' ') })
      setOpen(false)
      toggle.current?.focus()
    }}>
      <div className={styles.filterFields}>
        <div className="search-filter-field"><label className="search-filter-label" htmlFor="admin-collection-query">Search</label><input id="admin-collection-query" className={styles.query} type="search" value={draft.query} disabled={pending} placeholder="Search titles or descriptions…" onChange={event => setDraft(value => ({ ...value, query: event.target.value }))} /></div>
        <ContentTypeSelect value={draft.category} onChange={category => setDraft(value => ({ ...value, category }))} disabled={pending} options={categories.map(category => ({ value: category.slug, label: category.name }))} />
        <FilterSelect id="admin-collection-status" label="Status" value={draft.status} onChange={status => setDraft(value => ({ ...value, status }))} disabled={pending} options={[{ value: 'all', label: 'All statuses' }, { value: 'draft', label: 'Drafts' }, { value: 'published', label: 'Published' }, { value: 'archived', label: 'Archived' }]} />
        <TagInput value={draft.tag} input={input} onChange={tag => setDraft(value => ({ ...value, tag }))} onInputChange={setInput} suggestions={tags} disabled={pending} />
        <FilterSelect id="admin-collection-sort" label="Sort by" value={draft.sort} onChange={sort => setDraft(value => ({ ...value, sort }))} disabled={pending} options={ADMIN_SORT_OPTIONS} />
        <FilterSelect id="admin-collection-match" label="Match tags" value={draft.tagMatch} onChange={tagMatch => setDraft(value => ({ ...value, tagMatch }))} disabled={pending} options={[{ value: 'all', label: 'All tags' }, { value: 'any', label: 'Any tag' }]} />
      </div>
      <div className="search-filter-footer"><div className="search-filter-actions"><button type="button" className="search-filter-reset" disabled={pending} onClick={() => change({ ...EMPTY_ADMIN_FILTERS, status: applied.status })}>Clear filters</button><button type="submit" className="search-filter-apply" disabled={pending}>{pending ? 'Applying…' : 'Apply filters'}</button></div></div>
    </form>
    {chips.length > 0 && <div className="search-active-filters" aria-label="Active collection filters">{chips.map(chip => <button type="button" key={chip.key} disabled={pending} aria-label={`Remove filter: ${chip.label}`} onClick={() => change(chip.values)}>{chip.label}<X size={14} aria-hidden="true" /></button>)}<button type="button" className="search-clear-all" disabled={pending} onClick={() => change({ ...EMPTY_ADMIN_FILTERS, status: applied.status })}>Clear all</button></div>}
  </div>
}
