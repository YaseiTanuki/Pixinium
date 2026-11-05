import type { CatalogDetail } from './entities/catalog'
import { CONTENT_SCHEMAS } from './content-types'
import { imageViewUrl } from './media'

/** Match the representative original to the first image in the item's download order. */
export function itemSeoImage(item: CatalogDetail) {
  const original = item.media?.find(asset => asset.role === 'download' && asset.mediaType === 'image')
  if (original) return {
    url: imageViewUrl(original.url), altText: original.altText || item.item.title,
    width: original.width, height: original.height, focalX: original.focalX, focalY: original.focalY,
  }
  // Other categories may have artwork only; do not advertise a thumbnail as an Images original.
  return item.category.metadataSchemaKey === CONTENT_SCHEMAS.image ? null : item.cover
}
