import { contentKind, type ContentKind } from '@/lib/content-types'
import type { CatalogDetail } from '@/lib/entities/catalog'
import { ImageGallery } from './image-gallery'
import { MusicList } from './music-list'
import { GameGrid } from './game-grid'
import { AssetGrid } from './asset-grid'

// Layouts follow the stable schema; new or renamed categories need no route changes.
const layouts = { image: ImageGallery, music: MusicList, game: GameGrid, asset: AssetGrid } satisfies Record<ContentKind, unknown>

export function CategoryResults({ items, schemaKey }: { items: CatalogDetail[]; schemaKey: string }) {
  const Layout = layouts[contentKind(schemaKey)]
  return <Layout items={items} />
}
