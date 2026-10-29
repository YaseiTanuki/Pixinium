import type { CatalogCard } from './entities/catalog'

export const CATALOG_DISPLAY = { relatedItems: 9, homeItems: 9, archivePageSize: 18 } as const

export function categoryHref(slug: string, { query, page }: { query?: string; page?: number } = {}): string {
  const params = new URLSearchParams()
  if (query) params.set('q', query)
  if (page && page > 1) params.set('page', String(page))
  const search = params.toString()
  return `/${encodeURIComponent(slug)}${search ? `?${search}` : ''}`
}

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
