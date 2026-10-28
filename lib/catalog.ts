import type { CatalogCard } from './entities/catalog'

export const CATALOG_DISPLAY = { relatedItems: 10 } as const

export function searchHref({ use, query }: { use?: string; query?: string } = {}): string {
  const params = new URLSearchParams()
  if (use) params.set('use', use)
  if (query) params.set('q', query)
  const search = params.toString()
  return search ? `/search?${search}` : '/search'
}

export function itemHref(card: CatalogCard): string {
  return `/items/${encodeURIComponent(card.category.slug)}/${encodeURIComponent(card.item.slug)}`
}
