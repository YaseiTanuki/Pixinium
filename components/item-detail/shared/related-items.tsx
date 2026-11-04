import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { CategoryResults } from '@/components/category/category-results'
import type { CatalogDetail } from '@/lib/entities/catalog'
import '@/app/categories/category.css'
import '@/components/category/asset-folder-card.css'

export function RelatedItems({ items, schemaKey }: { items: CatalogDetail[]; schemaKey: string }) {
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
      <div className="detail-related-results">
        <CategoryResults items={items} schemaKey={schemaKey} />
      </div>
    </section>
  )
}
