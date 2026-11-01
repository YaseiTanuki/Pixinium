import { MusicPlayer } from '@/components/music-player'
import type { CatalogDetail } from '@/lib/entities/catalog'
import { ArtworkDetail } from '../shared/artwork-detail'

export function MusicDetail({ item }: { item: CatalogDetail }) {

  return (
    <div className="detail-media-column">
      <ArtworkDetail item={item}><MusicPlayer key={item.item.id} item={item} /></ArtworkDetail>
    </div>
  )
}
