'use client'

import { usePathname } from 'next/navigation'
import CategoryLoading from '@/app/[category]/loading'
import { categoryHref } from '@/lib/catalog'
import { useCategoryNavigationState } from '@/components/category-navigation-state'
import { NavigationSkeleton } from '@/components/navigation-skeleton'

export function RootNavigationLoading() {
  const pathname = usePathname()
  const { categories } = useCategoryNavigationState()
  if (categories?.some(category => categoryHref(category.slug) === pathname)) return <CategoryLoading />
  if (pathname === '/search') return <NavigationSkeleton variant="search" />
  return <NavigationSkeleton variant="home" />
}
