import type { CatalogDetail } from '@/lib/entities/catalog'
import { ArtworkDetail } from '../shared/artwork-detail'

export function ImageDetail({ item }: { item: CatalogDetail }) {
  return <ArtworkDetail item={item} />
}
