import type { CatalogDetail, ItemFact } from './entities/catalog'
import { usesAutomaticFacts } from './content-types'
import { imageFacts } from './image-facts'

export function catalogFacts(schemaKey: string, itemId: string, media: CatalogDetail['media'], stored: ItemFact[]): ItemFact[] {
  if (!usesAutomaticFacts(schemaKey)) return stored
  return imageFacts(itemId, media.find(asset => asset.role === 'download' && asset.mediaType === 'image'),
    stored.find(fact => fact.key === 'creator')?.value ?? 'Unknown')
}
