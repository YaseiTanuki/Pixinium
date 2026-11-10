'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Category } from '@/lib/entities/catalog'

export type NavigationCategory = Pick<Category, 'id' | 'slug' | 'name' | 'iconKey'>

type NavigationState = {
  categories: NavigationCategory[] | null
  setCategories: (categories: NavigationCategory[]) => void
  scrollLeft: { current: number }
}

const CategoryNavigationContext = createContext<NavigationState | null>(null)

export function CategoryNavigationProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<NavigationCategory[] | null>(null)
  const scrollLeft = useRef(0)
  return <CategoryNavigationContext.Provider value={{ categories, setCategories, scrollLeft }}>{children}</CategoryNavigationContext.Provider>
}

export function useCategoryNavigationState() {
  const state = useContext(CategoryNavigationContext)
  if (!state) throw new Error('CategoryNavigationProvider is missing')
  return state
}

export function useRememberCategories(categories: NavigationCategory[] | undefined) {
  const { setCategories } = useCategoryNavigationState()
  useEffect(() => {
    if (categories) setCategories(categories)
  }, [categories, setCategories])
}
