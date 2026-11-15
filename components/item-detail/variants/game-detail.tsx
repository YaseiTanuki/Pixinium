import type { CatalogDetail } from '@/lib/entities/catalog'
import { ArtworkDetail } from '../shared/artwork-detail'
import { isPlayableGame } from '@/lib/admin/game'
import { GamePlayer } from './game-player'

export function GameDetail({ item }: { item: CatalogDetail }) {
  if (isPlayableGame(item.tags, item.media)) return <GamePlayer id={item.item.id} title={item.item.title} cover={item.cover?.url} />
  return <ArtworkDetail item={item} />
}
