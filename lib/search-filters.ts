export const SEARCH_SORT_OPTIONS = [
  { value: '', label: 'Recommended' },
  { value: 'newest', label: 'Newest first' },
  { value: 'views', label: 'Most viewed' },
  { value: 'downloads', label: 'Most downloaded' },
  { value: 'title', label: 'Title A–Z' },
] as const

export function searchTags(value: string): string[] {
  return [...new Set(value.toLowerCase().split(/[\s,]+/).map(tag => tag.replace(/^#+/, '')).filter(Boolean))]
}

export function searchCategories(value: string): string[] {
  return [...new Set(value.split(',').map(category => category.trim()).filter(Boolean))]
}

export function searchSort(value: string): string {
  return SEARCH_SORT_OPTIONS.some(option => option.value === value) ? value : ''
}
