/** Storage identity stays stable when titles or suitable uses change. */
export function itemStorageDirectory(category: string, itemId: string) {
  if (!/^[a-z][a-z0-9-]*$/.test(category) || !/^[1-9][0-9]*$/.test(itemId)) throw new Error('Invalid storage identity')
  const roots: Record<string, string> = { images: 'image', music: 'audio', games: 'game' }
  return `${roots[category] ?? category}/${itemId}`
}
