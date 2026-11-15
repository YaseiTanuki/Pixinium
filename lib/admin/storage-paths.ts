/** Storage identity stays stable when titles or tags change. */
export function itemStorageDirectory(category: string, itemId: string, version?: string) {
  if (!/^[a-z][a-z0-9-]*$/.test(category) || !/^[1-9][0-9]*$/.test(itemId)) throw new Error('Invalid storage identity')
  if (version !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(version)) throw new Error('Invalid storage version')
  const roots: Record<string, string> = { images: 'image', music: 'audio', games: 'game' }
  return `${roots[category] ?? category}/${itemId}${version ? `/v-${version}` : ''}`
}
