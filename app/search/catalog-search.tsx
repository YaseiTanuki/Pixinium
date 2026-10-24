'use client'

import { SiteHeader } from '@/components/site-header'
import { CatalogCard } from '@/components/catalog-card'

import { useMemo, useState } from 'react'
import { ListFilter } from 'lucide-react'

import type { CatalogDetail, Category } from '@/lib/entities/catalog'

export default function CatalogSearch({ items, categories, initialFilter = '', initialQuery = '' }: { items: CatalogDetail[]; categories: Category[]; initialFilter?: string; initialQuery?: string }) {
  const [activeFilter, setActiveFilter] = useState(initialFilter)
  const [query, setQuery] = useState(initialQuery)
  const filters = [{ slug: '', name: 'All items' }, ...categories]
  const visibleResults = useMemo(() => items.filter((item) => {
    const matchesFilter = activeFilter === '' || item.category.slug === activeFilter
    const matchesQuery = !query || `${item.item.title} ${item.item.summary} ${item.category.name} ${item.tags.map(tag => tag.name).join(' ')}`.toLowerCase().includes(query.toLowerCase())
    return matchesFilter && matchesQuery
  }), [activeFilter, items, query])

  return (
    <main className="min-h-screen bg-[#f8f5f1] text-[#211d20]">
      <div className="mx-auto flex min-h-screen max-w-[1500px]">
<section className="min-w-0 flex-1">
          <SiteHeader categories={categories} activeFilter={activeFilter} query={query} onQueryChange={setQuery} onFilterChange={setActiveFilter} />

          <div className="px-5 py-8 md:px-10 md:py-10">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#e94343]">Archive search</p><h1 className="text-3xl font-black tracking-[-0.035em] md:text-[42px]">Your little <span className="relative inline-block">treasure pile<span className="absolute -bottom-1 left-0 h-1 w-full rotate-[-2deg] rounded-full bg-[#e94343]" /></span>.</h1><p className="mt-3 text-sm text-[#a29a95]">{visibleResults.length} lovely things found in the archive</p></div></div>

            <div className="mt-8 flex flex-wrap items-center gap-2"><span className="mr-1 text-xs font-bold text-[#a29a95]">Showing</span>{filters.map(({ slug, name }) => <button key={slug} onClick={() => setActiveFilter(slug)} className={`rounded-full border px-3.5 py-2 text-xs font-bold transition-colors ${activeFilter === slug ? 'border-[#211d20] bg-[#211d20] text-white' : 'border-[#e4dad4] bg-white text-[#766d68] hover:border-[#e94343]'}`}>{name}</button>)}</div>

            <div className="mt-7 flex items-center justify-between"><p className="text-xs font-semibold text-[#a29a95]">{visibleResults.length ? `1–${visibleResults.length} results` : 'No treasures found'}</p><button className="rounded-lg p-2 text-[#e94343]" aria-label="Grid view"><ListFilter size={18} /></button></div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{visibleResults.map((item) => <CatalogCard key={item.item.id} item={item} />)}</div>
          </div>
        </section>
      </div>
    </main>
  )
}
