import type { CatalogCard } from './entities/catalog'

export const CATALOG_DISPLAY = { relatedItems: 10, homeItems: 10, archivePageSize: 5 } as const

export function searchHref({ use, query, page }: { use?: string; query?: string; page?: number } = {}): string {
  const params = new URLSearchParams()
  if (use) params.set('use', use)
  if (query) params.set('q', query)
  if (page && page > 1) params.set('page', String(page))
  const search = params.toString()
  return search ? `/search?${search}` : '/search'
}

export function itemHref(card: CatalogCard): string {
  return `/items/${encodeURIComponent(card.category.slug)}/${encodeURIComponent(card.item.slug)}`
}
