'use client'

import { SiteHeader } from '@/components/site-header'
import { ArchiveImage } from '@/components/archive-image'

import { useMemo, useState } from 'react'
import {
  Bell,
  ChevronDown,
  Download,
  Filter,
  Gamepad2,
  Heart,
  Image as ImageIcon,
  LayoutGrid,
  ListFilter,
  Music2,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react'

import { filters, itemHref, type ArchiveItem } from '@/lib/archive'
import { useSavedItems } from '@/lib/saved-items'
import Link from 'next/link'

export default function Archive({ items, initialFilter = 'All items', initialQuery = '' }: { items: ArchiveItem[]; initialFilter?: string; initialQuery?: string }) {
  const [activeFilter, setActiveFilter] = useState(initialFilter)
  const [query, setQuery] = useState(initialQuery)
  const { saved, toggleSaved } = useSavedItems()
  const [menuOpen, setMenuOpen] = useState(false)
  const visibleResults = useMemo(() => items.filter((item) => {
    const matchesFilter = activeFilter === 'All items' || item.category === activeFilter
    const matchesQuery = !query || `${item.title} ${item.category}`.toLowerCase().includes(query.toLowerCase())
    return matchesFilter && matchesQuery
  }), [activeFilter, items, query])

  return (
    <main className="min-h-screen bg-[#f8f5f1] text-[#211d20]">
      <div className="mx-auto flex min-h-screen max-w-[1500px]">
        <aside className="hidden">
          <div className="flex items-center justify-between">
            <a href="#" className="flex items-center gap-2.5" aria-label="Pixinium home"><span className="flex size-9 items-center justify-center rounded-[11px] bg-[#e94343] text-white shadow-[3px_3px_0_#211d20]"><Sparkles size={18} fill="currentColor" /></span><span className="font-display text-[21px] font-black tracking-[-0.03em]">pixinium<span className="text-[#e94343]">.</span></span></a>
            <button className="rounded-lg p-2 lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={18} /></button>
          </div>
          <p className="mt-11 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#a29a95]">Explore archive</p>
          <nav className="mt-3 flex flex-col gap-1" aria-label="Main navigation">
            {filters.map((label, index) => { const Icon = index === 0 ? LayoutGrid : index === 1 ? ImageIcon : index === 2 ? Music2 : Gamepad2; return <button key={label} onClick={() => { setActiveFilter(label); setMenuOpen(false) }} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${activeFilter === label ? 'bg-[#211d20] text-white shadow-[3px_3px_0_#e94343]' : 'text-[#766d68] hover:bg-[#f4ece7]'}`}><Icon size={17} />{label}{index === 0 && <span className="ml-auto text-[11px] text-[#f9aaa5]">458</span>}</button> })}
          </nav>
          <div className="my-8 h-px bg-[#eee5df]" />
          <p className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#a29a95]">Quick filters</p>
          <div className="mt-3 flex flex-col gap-1"><button className="flex items-center gap-3 rounded-xl px-3 py-2 text-left text-xs font-semibold text-[#766d68] hover:bg-[#f4ece7]"><Heart size={16} /> Saved by me</button><button className="flex items-center gap-3 rounded-xl px-3 py-2 text-left text-xs font-semibold text-[#766d68] hover:bg-[#f4ece7]"><Download size={16} /> Downloaded</button></div>
          <div className="mt-auto rounded-2xl border border-[#eaded7] bg-[#f9eee8] p-4"><div className="flex items-center justify-between"><span className="text-xs font-bold">Tiny reminder</span><span className="text-lg">♡</span></div><p className="mt-2 text-[11px] leading-4 text-[#887d76]">Good things are worth<br />keeping close.</p></div>
        </aside>

        <section className="min-w-0 flex-1">
          <SiteHeader activeFilter={activeFilter} query={query} onQueryChange={setQuery} onFilterChange={setActiveFilter} />

          <div className="px-5 py-8 md:px-10 md:py-10">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#e94343]">Archive search</p><h1 className="text-3xl font-black tracking-[-0.035em] md:text-[42px]">Your little <span className="relative inline-block">treasure pile<span className="absolute -bottom-1 left-0 h-1 w-full rotate-[-2deg] rounded-full bg-[#e94343]" /></span>.</h1><p className="mt-3 text-sm text-[#a29a95]">{visibleResults.length} lovely things found in the archive</p></div><button className="flex w-fit items-center gap-2 rounded-xl border border-[#e4dad4] bg-white px-4 py-2.5 text-sm font-bold text-[#766d68] hover:border-[#e94343] hover:text-[#e94343]"><SlidersHorizontal size={16} /> Sort: newest</button></div>

            <div className="mt-8 flex flex-wrap items-center gap-2"><span className="mr-1 text-xs font-bold text-[#a29a95]">Showing</span>{filters.map((filter) => <button key={filter} onClick={() => setActiveFilter(filter)} className={`rounded-full border px-3.5 py-2 text-xs font-bold transition-colors ${activeFilter === filter ? 'border-[#211d20] bg-[#211d20] text-white' : 'border-[#e4dad4] bg-white text-[#766d68] hover:border-[#e94343]'}`}>{filter}</button>)}<button className="ml-auto flex items-center gap-2 rounded-full border border-[#e4dad4] bg-transparent px-3.5 py-2 text-xs font-bold text-[#766d68] hover:bg-white"><Filter size={14} /> More filters</button></div>

            <div className="mt-7 flex items-center justify-between"><p className="text-xs font-semibold text-[#a29a95]">{visibleResults.length ? `1–${visibleResults.length} results` : 'No treasures found'}</p><button className="rounded-lg p-2 text-[#e94343]" aria-label="Grid view"><ListFilter size={18} /></button></div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{visibleResults.map((item) => <ResultCard key={item.title} item={item} saved={saved.includes(item.title)} onSave={() => toggleSaved(item.title)} />)}</div>
          </div>
        </section>
      </div>
    </main>
  )
}

function ResultCard({ item, saved, onSave }: { item: ArchiveItem; saved: boolean; onSave: () => void }) {
  return <article className="group overflow-hidden rounded-[18px] border border-[#e7ddd7] bg-[#fffdfb] transition-transform hover:-translate-y-1 hover:shadow-[4px_4px_0_#e94343]"><div className={`relative flex h-[178px] items-center justify-center overflow-hidden ${item.color}`}><Link href={itemHref(item)} className="absolute inset-0 z-10" aria-label={`View ${item.title}`} />{item.image ? <ArchiveImage src={item.image} alt={item.title} className={`h-full w-full object-cover ${item.crop}`} /> : <div className="flex flex-col items-center"><div className="mb-3 flex size-16 items-center justify-center rounded-[20px] border-2 border-[#f55b58] bg-[#211d20] text-[#f55b58] shadow-[3px_3px_0_#f55b58]"><Music2 size={30} /></div><span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#f3d5cc]">side b / 07</span></div>}<span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-[#766d68]">{item.category}</span><button onClick={onSave} aria-label={`${saved ? 'Remove' : 'Save'} ${item.title}`} aria-pressed={saved} className={`absolute right-3 top-3 z-20 rounded-lg p-2 ${saved ? 'bg-[#e94343] text-white' : 'bg-white/90 text-[#766d68] transition-opacity md:opacity-0 md:group-hover:opacity-100 focus:opacity-100'}`}><Heart size={15} fill={saved ? 'currentColor' : 'none'} /></button></div><div className="p-4"><div className="flex items-start justify-between gap-2"><div><h2 className="text-sm font-black"><Link href={itemHref(item)}>{item.title}</Link></h2><p className="mt-1 text-[11px] text-[#a29a95]">{item.meta}</p></div><span className="text-lg text-[#e94343]">✦</span></div><div className="mt-4 flex items-center justify-between border-t border-[#f0e8e3] pt-3"><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#b1a6a0]">Pixinium pick</span><Link href={itemHref(item)} className="text-xs font-bold text-[#e94343]">View item</Link></div></div></article>
}
