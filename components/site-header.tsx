'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Heart, Search } from 'lucide-react'
import type { Category } from '@/lib/entities/catalog'
import { categoryIcon } from '@/lib/category-icons'
import { useSavedItems } from '@/lib/saved-items'

type SiteHeaderProps = {
  categories: Category[]
  activeFilter?: string
  query?: string
  onQueryChange?: (value: string) => void
  onFilterChange?: (value: string) => void
}

export function SiteHeader({ categories, activeFilter = '', query, onQueryChange, onFilterChange }: SiteHeaderProps) {
  const router = useRouter()
  const { saved } = useSavedItems()
  const filters = [{ slug: '', name: 'All items', iconKey: 'grid' }, ...categories]

  return (
    <header className="page-shell flex text-[#211d20] min-h-[76px] flex-wrap items-center gap-3 border-b border-[#e9e1db] bg-[#f8f5f1]/90 py-3 backdrop-blur">
            <Link href="/" className="mr-3 font-display text-xl font-black tracking-[-0.03em]" aria-label="Pixinium home">pixinium<span className="text-[#e94343]">.</span></Link><form action="/search" method="get" role="search" className="relative min-w-[190px] flex-1 md:max-w-[360px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a29a95]" size={16} /><input value={query} onChange={onQueryChange ? (event) => onQueryChange(event.target.value) : undefined} aria-label="Search the archive" name="q" type="search" placeholder="Search wallpapers, music, games?" className="h-10 w-full rounded-xl border border-[#e4dad4] bg-white pl-10 pr-4 text-sm outline-none placeholder:text-[#b2aaa5] focus:border-[#e94343]" /></form>
            <nav className="order-3 flex w-full flex-wrap items-center gap-1 md:order-2 md:w-auto md:flex-1" aria-label="Archive categories">{filters.map(({ slug, name, iconKey }) => { const Icon = categoryIcon(iconKey); return <button key={slug} onClick={() => onFilterChange ? onFilterChange(slug) : router.push(`/search?category=${encodeURIComponent(slug)}`)} aria-label={name} aria-pressed={activeFilter === slug} title={name} className={`flex size-11 shrink-0 items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-colors lg:h-auto lg:w-auto lg:px-2.5 lg:py-2 ${activeFilter === slug ? 'bg-[#211d20] text-white shadow-[2px_2px_0_#e94343]' : 'text-[#766d68] hover:bg-white'}`}><Icon size={14} aria-hidden="true" /><span className="hidden lg:inline">{name}</span></button> })}</nav>
            <Link href="/?collection=saved" className="ml-auto flex items-center md:order-3 gap-2 rounded-xl border border-[#e4dad4] px-3 py-2.5 text-xs font-bold text-[#766d68] hover:bg-white" title="Saved on this device"><Heart size={16} /><span>My collection</span><span>{saved.length}</span></Link>
          </header>
  )
}
