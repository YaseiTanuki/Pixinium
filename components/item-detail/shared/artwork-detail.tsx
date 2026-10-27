import { Image as ImageIcon, Moon, Sparkles } from 'lucide-react'
import type { CatalogDetail } from '@/lib/entities/catalog'

// Image and game share the same artwork presentation.
export function ArtworkDetail({ item }: { item: CatalogDetail }) {
  const isRecordArtwork = item.category.artworkStyle === 'record'

  return (
    <div className="detail-media-column">
      <section
        className={`detail-preview ${isRecordArtwork ? 'detail-preview-music' : ''}`}
        aria-label={`${item.item.title} artwork`}
      >
        <div className="detail-preview-top">
          <span><Sparkles size={13} aria-hidden="true" /> THE LITTLE DETAILS</span>
          <span>PIXINIUM / {item.category.name.toUpperCase()}</span>
        </div>
        <div className="detail-art" style={{ backgroundColor: item.item.accentColor }}>
          {item.cover ? (
            <img src={item.cover.url} alt={item.cover.altText} width={800} height={650} fetchPriority="high" className="detail-image" />
          ) : isRecordArtwork ? (
            <div className="detail-record" aria-hidden="true">
              <span className="detail-record-label">PIXINIUM RECORDS</span>
              <div className="record-disc"><span><Moon size={44} fill="currentColor" /></span></div>
              <span className="detail-record-caption">A LITTLE SOUNDTRACK FOR YOUR WORLD</span>
            </div>
          ) : <ImageIcon size={60} aria-label="No cover artwork" />}
          <span className="detail-stamp" aria-hidden="true">
            A LITTLE<br />FIND. A LOT<br />TO LOVE.<Sparkles size={19} />
          </span>
        </div>
      </section>
    </div>
  )
}
