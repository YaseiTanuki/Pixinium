import Link from 'next/link'
import { Grid2X2 } from 'lucide-react'
import { categoryHref } from '@/lib/catalog'
import { categoryIcon } from '@/lib/category-icons'
import type { Category } from '@/lib/entities/catalog'

export function CategoryNavigation({ categories, current }: { categories: Category[]; current?: string }) {
  return <nav className="category-navigation" aria-label="Browse categories">
    <Link href="/search" aria-label="All" title="All" aria-current={current === 'all' ? 'page' : undefined}><Grid2X2 size={18} aria-hidden="true" /><span className="sr-only">All</span></Link>
    {categories.map(category => {
      const Icon = categoryIcon(category.iconKey)
      return <Link key={category.id} href={categoryHref(category.slug)} aria-label={category.name} title={category.name} aria-current={current === category.slug ? 'page' : undefined}>
        <Icon size={18} aria-hidden="true" /><span className="sr-only">{category.name}</span>
      </Link>
    })}
  </nav>
}
