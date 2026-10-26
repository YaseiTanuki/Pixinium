import type { ItemFact } from './entities/catalog'

type ImageDetails = { width?: number | null; height?: number | null; mimeType?: string | null }

/** Fixed image facts, derived from the original asset rather than its thumbnail. */
export function imageFacts(itemId: string, original: ImageDetails | undefined, creator: string): ItemFact[] {
  const resolution = original?.width && original?.height ? `${original.width} \u00d7 ${original.height} px` : 'Unavailable'
  const format = original?.mimeType?.startsWith('image/') ? original.mimeType.slice(6).toUpperCase() : 'Unavailable'
  return [
    { key: 'resolution', label: 'Resolution', value: resolution },
    { key: 'format', label: 'Format', value: format },
    { key: 'creator', label: 'Creator', value: creator.trim() === 'AI generated' ? 'Pixinium' : creator.trim() || 'Unknown' },
  ].map((fact, sortOrder) => ({ ...fact, itemId, sortOrder }))
}

export function imageCreator(source: 'studio' | 'agent', username: string | null | undefined): string {
  return source === 'agent' ? 'Pixinium' : username?.trim() || 'Unknown'
}
