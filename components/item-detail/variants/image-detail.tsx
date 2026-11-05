import type { CatalogDetail } from '@/lib/entities/catalog'
import { ArtworkDetail } from '../shared/artwork-detail'
import { itemSeoImage } from '@/lib/item-image'

export function ImageDetail({ item }: { item: CatalogDetail }) {
  const original = itemSeoImage(item)
  return <ArtworkDetail item={{ ...item, cover: original ?? item.cover }} imageLabel={original ? 'Original · Full resolution' : undefined} />
}
