import type { CatalogDetail } from '@/lib/entities/catalog'
import { ArtworkDetail } from '../shared/artwork-detail'

export function GameDetail({ item }: { item: CatalogDetail }) {
  return <ArtworkDetail item={item} />
}
