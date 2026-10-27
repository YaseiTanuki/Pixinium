'use client'

import { SiteHeader } from '@/components/site-header'
import { CatalogCard } from '@/components/catalog-card'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Gamepad2, Grid2X2, Image, Layers, ListFilter, Monitor, Music2, Smartphone, Sparkles, UserRound, type LucideIcon } from 'lucide-react'

import type { CatalogDetail, ContentUse } from '@/lib/entities/catalog'

const filterIcons: Record<string, LucideIcon> = {
  images: Image, wallpaper: Smartphone, background: Monitor,
  avatar: UserRound, music: Music2, games: Gamepad2, assets: Layers,
}

export default function CatalogSearch({ items, uses, initialUse = '', initialQuery = '' }: { items: CatalogDetail[]; uses: ContentUse[]; initialUse?: string; initialQuery?: string }) {
  const [activeUse, setActiveUse] = useState(initialUse)
  const [query, setQuery] = useState(initialQuery)
  const filterTrack = useRef<HTMLDivElement>(null)
  const filterMarker = useRef<HTMLSpanElement>(null)
  const filters = [{ slug: '', name: 'All' }, ...uses]
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
  }, [activeUse, uses])
  const visibleResults = useMemo(() => items.filter((item) => {
    const matchesQuery = !query || `${item.item.title} ${item.item.summary} ${item.category.name} ${item.tags.map(tag => tag.name).join(' ')} ${item.uses.map(use => use.name).join(' ')}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (!activeUse || item.uses.some(use => use.slug === activeUse))
  }), [activeUse, items, query])

  return (
    <main className="min-h-screen bg-[#f8f5f1] text-[#211d20]">
      <div className="flex min-h-screen">
<section className="min-w-0 flex-1">
          <SiteHeader query={query} onQueryChange={setQuery} />

          <div className="page-shell search-content py-6">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#e94343]">Archive search</p><h1 className="text-3xl font-black tracking-[-0.035em] md:text-[42px]">Your little <span className="relative inline-block">treasure pile<span className="absolute -bottom-1 left-0 h-1 w-full rotate-[-2deg] rounded-full bg-[#e94343]" /></span>.</h1><p className="mt-3 text-sm text-[#a29a95]">{visibleResults.length} lovely things found in the archive</p></div></div>

            <div className="search-filter-scroll" role="group" aria-label="Filter by use">
              <div className="search-filter-track" ref={filterTrack}>
                {filters.map(({ slug, name }) => {
                  const Icon = slug === '' ? Sparkles : filterIcons[slug] ?? Grid2X2
                  return <button key={slug} type="button" onClick={() => setActiveUse(slug)} aria-pressed={activeUse === slug} className="search-filter-tab">
                    <Icon size={17} strokeWidth={1.7} aria-hidden="true" /><span>{name}</span>
                  </button>
                })}
                <span className="search-filter-marker" ref={filterMarker} aria-hidden="true" />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between"><p className="text-xs font-semibold text-[#a29a95]">{visibleResults.length ? `1–${visibleResults.length} results` : 'No treasures found'}</p><button className="rounded-lg p-2 text-[#e94343]" aria-label="Grid view"><ListFilter size={18} /></button></div>
            <div className="search-results mt-2">{visibleResults.map((item) => <CatalogCard key={item.item.id} item={item} />)}</div>
          </div>
        </section>
      </div>
    </main>
  )
}
