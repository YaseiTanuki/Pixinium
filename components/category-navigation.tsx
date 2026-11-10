'use client'

import Link from 'next/link'
import { useLayoutEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { Grid2X2 } from 'lucide-react'
import { categoryHref } from '@/lib/catalog'
import { categoryIcon } from '@/lib/category-icons'
import { useCategoryNavigationState, useRememberCategories, type NavigationCategory } from '@/components/category-navigation-state'

export function CategoryNavigationAllLink({ current }: { current?: boolean }) {
  return <Link href="/search" aria-label="All" title="All" aria-current={current ? 'page' : undefined}><Grid2X2 size={18} aria-hidden="true" /><span className="sr-only">All</span></Link>
}

export function CategoryNavigation({ categories, current }: { categories?: NavigationCategory[]; current?: string }) {
  const { categories: remembered, scrollLeft } = useCategoryNavigationState()
  const nav = useRef<HTMLElement>(null)
  const pathname = usePathname()
  useRememberCategories(categories)
  const entries = categories ?? remembered
  const active = current ?? (pathname === '/search' ? 'all' : entries?.find(category => categoryHref(category.slug) === pathname)?.slug)

  useLayoutEffect(() => {
    const element = nav.current
    if (!element) return
    element.scrollLeft = scrollLeft.current
    return () => { scrollLeft.current = element.scrollLeft }
  }, [scrollLeft])

  return <nav ref={nav} className="category-navigation" aria-label="Browse categories" onScroll={event => { scrollLeft.current = event.currentTarget.scrollLeft }}>
    <CategoryNavigationAllLink current={active === 'all'} />
    {entries?.map(category => {
      const Icon = categoryIcon(category.iconKey)
      return <Link key={category.id} href={categoryHref(category.slug)} aria-label={category.name} title={category.name} aria-current={active === category.slug ? 'page' : undefined}>
        <Icon size={18} aria-hidden="true" /><span className="sr-only">{category.name}</span>
      </Link>
    })}
    {!entries && Array.from({ length: 4 }, (_, index) => <span className="category-navigation-placeholder" aria-hidden="true" key={index} />)}
  </nav>
}
