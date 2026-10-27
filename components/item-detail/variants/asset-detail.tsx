import { Image as ImageIcon } from 'lucide-react'
import type { CatalogDetail } from '@/lib/entities/catalog'

export function AssetDetail({ item }: { item: CatalogDetail }) {

  return (
    <div className="detail-media-column asset-detail-media">
      <section className="detail-preview" aria-label={`${item.item.title} thumbnail`}>
        <div className="detail-art" style={{ backgroundColor: item.item.accentColor }}>
          {item.cover ? (
            <img src={item.cover.url} alt={item.cover.altText} width={800} height={650}
              fetchPriority="high" className="detail-image" />
          ) : <ImageIcon size={60} aria-label="No thumbnail" />}
        </div>
      </section>
    </div>
  )
}
