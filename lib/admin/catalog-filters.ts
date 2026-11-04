import { searchCategories, searchTags } from '../search-filters'

export const ADMIN_CATALOG_PAGE_SIZE = 20
export const ADMIN_SORT_OPTIONS = [
  { value: '', label: 'Newest first' }, { value: 'oldest', label: 'Oldest first' },
  { value: 'title', label: 'Title A–Z' }, { value: 'views', label: 'Most viewed' },
  { value: 'downloads', label: 'Most downloaded' },
]
export type AdminCatalogFilters = { query: string; category: string; status: string; tag: string; tagMatch: string; sort: string }
export const EMPTY_ADMIN_FILTERS: AdminCatalogFilters = { query: '', category: '', status: 'published', tag: '', tagMatch: 'all', sort: '' }
type Params = Record<string, string | string[] | undefined>

export function parseAdminCatalogFilters(params: Params): AdminCatalogFilters {
  const text = (key: string) => typeof params[key] === 'string' ? params[key] as string : ''
  return {
    query: text('q').trim(),
    category: searchCategories(Array.isArray(params.category) ? params.category.join(',') : text('category')).join(','),
    status: ['draft', 'published', 'archived', 'all'].includes(text('status')) ? text('status') : 'published',
    tag: searchTags(Array.isArray(params.tag) ? params.tag.join(' ') : text('tag')).join(' '),
    tagMatch: text('match') === 'any' ? 'any' : 'all',
    sort: ADMIN_SORT_OPTIONS.some(option => option.value === text('sort')) ? text('sort') : '',
  }
}

export function adminCatalogHref(filters: AdminCatalogFilters, page = 1): string {
  const params = new URLSearchParams()
  for (const [key, value] of [['q', filters.query], ['category', filters.category], ['status', filters.status], ['tag', filters.tag], ['sort', filters.sort]]) {
    if (value) params.set(key, value)
  }
  if (filters.tag && filters.tagMatch === 'any') params.set('match', 'any')
  if (page > 1) params.set('page', String(page))
  return `/admin${params.size ? `?${params}` : ''}#admin-collection`
}

export function adminCatalogParams(filters: AdminCatalogFilters) {
  const query = filters.query.replace(/[\\%_]/g, '\\$&')
  return [query ? `%${query}%` : null, filters.category || null, filters.status === 'all' ? null : filters.status || 'published', filters.tag || null, filters.tagMatch]
}
