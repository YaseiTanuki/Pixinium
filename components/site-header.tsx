'use client'

// @refresh reset

import Link from 'next/link'
import { Heart, Search } from 'lucide-react'
import { useSavedItems } from '@/lib/saved-items'
import { BrandLogo } from '@/components/brand-logo'

type SiteHeaderProps = {
  query?: string
  onQueryChange?: (value: string) => void
}

export function SiteHeader({ query, onQueryChange }: SiteHeaderProps = {}) {
  const { saved } = useSavedItems()

  return (
    <header className="page-shell grid min-h-[76px] grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 border-b border-[#e9e1db] bg-[#f8f5f1]/90 py-3 text-[#211d20] backdrop-blur md:grid-cols-[auto_minmax(0,1fr)_auto_auto] md:gap-3">
      <BrandLogo className="md:mr-3" />
      <form action="/search" method="get" role="search" className="relative col-span-3 col-start-1 row-start-2 min-w-0 md:col-span-1 md:col-start-2 md:row-start-1 md:max-w-[360px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a29a95]" size={16} aria-hidden="true" />
        <input value={query} onChange={onQueryChange ? (event) => onQueryChange(event.target.value) : undefined} aria-label="Search the archive" name="q" type="search" placeholder="Search wallpapers, music, games?" className="h-11 min-w-0 w-full rounded-xl border border-[#e4dad4] bg-white pl-10 pr-4 text-base outline-none placeholder:text-[#b2aaa5] focus:border-[#e94343] md:text-sm" />
      </form>
      <Link href="/?collection=saved" className="col-start-2 row-start-1 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#e4dad4] px-3 py-2.5 text-xs font-bold text-[#766d68] hover:bg-white md:col-start-3" title="Saved on this device">
        <Heart size={16} aria-hidden="true" /><span className="sr-only sm:not-sr-only">My collection</span><span>{saved.length}</span>
      </Link>
      <Link href="/profile" className="col-start-3 row-start-1 flex min-h-11 items-center justify-center rounded-xl border border-[#e4dad4] px-3 py-2.5 text-xs font-bold hover:bg-white md:col-start-4">Account</Link>
    </header>
  )
}
