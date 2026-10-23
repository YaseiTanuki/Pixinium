'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, ChevronDown, Gamepad2, Image as ImageIcon, LayoutGrid, Music2, Search } from 'lucide-react'
import { filters } from '@/lib/archive'

type SiteHeaderProps = {
  activeFilter?: string
  query?: string
  onQueryChange?: (value: string) => void
  onFilterChange?: (value: string) => void
}

export function SiteHeader({ activeFilter = 'All items', query, onQueryChange, onFilterChange }: SiteHeaderProps) {
  const router = useRouter()

  return (
    <header className="mx-auto flex w-full max-w-[1500px] text-[#211d20] min-h-[76px] flex-wrap items-center gap-3 border-b border-[#e9e1db] bg-[#f8f5f1]/90 px-5 py-3 backdrop-blur md:px-10">
            <Link href="/" className="mr-3 font-display text-xl font-black tracking-[-0.03em]" aria-label="Pixinium home">pixinium<span className="text-[#e94343]">.</span></Link><form action="/search" method="get" role="search" className="relative min-w-[190px] flex-1 md:max-w-[360px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a29a95]" size={16} /><input value={query} onChange={onQueryChange ? (event) => onQueryChange(event.target.value) : undefined} aria-label="Search the archive" name="q" type="search" placeholder="Search wallpapers, music, games?" className="h-10 w-full rounded-xl border border-[#e4dad4] bg-white pl-10 pr-4 text-sm outline-none placeholder:text-[#b2aaa5] focus:border-[#e94343]" /></form>
            <nav className="order-3 flex w-full flex-wrap items-center gap-1 md:order-2 md:w-auto md:flex-1" aria-label="Archive categories">{filters.map((label, index) => { const Icon = index === 0 ? LayoutGrid : index === 1 ? ImageIcon : index === 2 ? Music2 : Gamepad2; return <button key={label} onClick={() => onFilterChange ? onFilterChange(label) : router.push(`/search?category=${encodeURIComponent(label)}`)} aria-label={label} aria-pressed={activeFilter === label} title={label} className={`flex size-11 shrink-0 items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-colors lg:h-auto lg:w-auto lg:px-2.5 lg:py-2 ${activeFilter === label ? 'bg-[#211d20] text-white shadow-[2px_2px_0_#e94343]' : 'text-[#766d68] hover:bg-white'}`}><Icon size={14} aria-hidden="true" /><span className="hidden lg:inline">{label}</span></button> })}</nav>
            <div className="ml-4 flex items-center gap-3"><button className="relative rounded-xl p-2.5 text-[#766d68] hover:bg-white" aria-label="Notifications"><Bell size={18} /><span className="absolute right-2 top-2 size-1.5 rounded-full bg-[#e94343]" /></button><div className="hidden h-7 w-px bg-[#e5dbd5] sm:block" /><button className="flex items-center gap-2 rounded-xl p-1.5 pr-2 hover:bg-white"><span className="flex size-8 items-center justify-center rounded-full bg-[#211d20] text-xs font-black text-white">P</span><span className="hidden text-left sm:block"><span className="block text-xs font-bold">pomu</span><span className="block text-[10px] text-[#a29a95]">collector</span></span><ChevronDown size={14} className="hidden text-[#a29a95] sm:block" /></button></div>
          </header>
  )
}
