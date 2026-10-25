/** Normalize the title; uniqueness is resolved within its category at save time. */
export function createItemSlug(title: string): string {
  const name = title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '').slice(0, 80).replace(/-$/g, '') || 'item'
  return name
}
