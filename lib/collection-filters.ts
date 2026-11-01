import type { CatalogCard, Tag } from './entities/catalog'
import { searchCategories, searchTags, type CatalogFilterValues } from './search-filters'

export type SavedCatalogCard = CatalogCard & { tags: Tag[] }
export const COLLECTION_SORT_OPTIONS = [
  { value: '', label: 'Recently saved' },
  { value: 'oldest', label: 'Oldest saved' },
  { value: 'title', label: 'Title A–Z' },
  { value: 'views', label: 'Most viewed' },
  { value: 'downloads', label: 'Most downloaded' },
]

export function filterSavedItems(items: SavedCatalogCard[], filters: CatalogFilterValues): SavedCatalogCard[] {
  const categories = searchCategories(filters.category)
  const tags = searchTags(filters.tag)
  const query = filters.query?.trim().toLowerCase() ?? ''
  const visible = items.filter(item => {
    if (categories.length && !categories.includes(item.category.slug)) return false
    if (query && !`${item.item.title} ${item.item.summary} ${item.category.name}`.toLowerCase().includes(query)) return false
    const matches = (tag: string) => item.tags.some(option => option.slug.toLowerCase() === tag || option.name.toLowerCase() === tag)
    return !tags.length || (filters.tagMatch === 'any' ? tags.some(matches) : tags.every(matches))
  })
  if (filters.sort === 'oldest') return visible.reverse()
  if (filters.sort === 'title') return visible.sort((a, b) => a.item.title.localeCompare(b.item.title))
  if (filters.sort === 'views') return visible.sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))
  if (filters.sort === 'downloads') return visible.sort((a, b) => (b.downloadCount ?? 0) - (a.downloadCount ?? 0))
  return visible
}
