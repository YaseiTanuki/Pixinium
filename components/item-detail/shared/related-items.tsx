import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { CatalogCard } from '@/components/catalog-card'
import { MasonryGrid } from '@/components/masonry-grid'
import type { CatalogCard as Card } from '@/lib/entities/catalog'

export function RelatedItems({ items }: { items: Card[] }) {
  if (items.length === 0) return null

  return (
    <section className="detail-related" aria-labelledby="related-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">KEEP THE GOOD THINGS COMING</p>
          <h2 id="related-title">A few more little favorites<span>.</span></h2>
        </div>
        <Link href="/search" className="archive-link">
          Explore the archive <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <MasonryGrid className="discovery-grid">
        {items.map(entry => <CatalogCard key={entry.item.id} item={entry} />)}
      </MasonryGrid>
    </section>
  )
}
