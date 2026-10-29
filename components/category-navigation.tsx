import Link from 'next/link'
import { House, Search } from 'lucide-react'
import { categoryHref } from '@/lib/catalog'
import { categoryIcon } from '@/lib/category-icons'
import type { Category } from '@/lib/entities/catalog'

export function CategoryNavigation({ categories, current }: { categories: Category[]; current?: string }) {
  return <nav className="category-navigation" aria-label="Browse categories">
    <Link href="/"><House size={16} aria-hidden="true" />Home</Link>
    {categories.map(category => {
      const Icon = categoryIcon(category.iconKey)
      return <Link key={category.id} href={categoryHref(category.slug)} aria-current={current === category.slug ? 'page' : undefined}>
        <Icon size={16} aria-hidden="true" />{category.name}
      </Link>
    })}
    <Link href="/search" aria-current={current === 'all' ? 'page' : undefined}><Search size={16} aria-hidden="true" />All finds</Link>
  </nav>
}
