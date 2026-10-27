import { MusicPlayer } from '@/components/music-player'
import type { CatalogDetail } from '@/lib/entities/catalog'

export function MusicDetail({ item }: { item: CatalogDetail }) {

  return (
    <div className="detail-media-column">
      <MusicPlayer key={item.item.id} item={item} />
    </div>
  )
}
