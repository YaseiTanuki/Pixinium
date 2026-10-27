import type { ItemFact } from './entities/catalog'

/** Pack quantity comes from original images; format comes from the download, never a preview. */
export function assetFacts(itemId: string, quantity: unknown, mimeType: string | null | undefined, creator: string): ItemFact[] {
  const count = typeof quantity === 'number' && Number.isSafeInteger(quantity) && quantity > 0
    ? String(quantity) : 'Unavailable'
  const format = mimeType === 'application/zip' ? 'ZIP' : 'Unavailable'

  return [
    { key: 'quantity', label: 'Quantity', value: count },
    { key: 'format', label: 'Format', value: format },
    { key: 'creator', label: 'Creator', value: creator.trim() || 'Unknown' },
  ].map((fact, sortOrder) => ({ ...fact, itemId, sortOrder }))
}
