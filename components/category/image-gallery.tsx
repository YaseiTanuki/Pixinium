import Link from 'next/link'
import { ItemArtwork } from '@/components/catalog-card'
import { MasonryGrid } from '@/components/masonry-grid'
import { itemHref } from '@/lib/catalog'
import type { CatalogDetail } from '@/lib/entities/catalog'

export function ImageGallery({ items }: { items: CatalogDetail[] }) {
  return <MasonryGrid className="category-image-gallery">{items.map(item =>
    <Link key={item.item.id} className="gallery-image" href={itemHref(item)} aria-label={`View ${item.item.title}`}>
      <ItemArtwork item={item} />
    </Link>
  )}</MasonryGrid>
}
