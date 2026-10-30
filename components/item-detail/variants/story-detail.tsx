import { Sparkles } from 'lucide-react'
import { StoryBookCover } from '@/components/story-book-cover'
import type { CatalogDetail } from '@/lib/entities/catalog'
import '@/components/story-book.css'

export function StoryDetail({ item }: { item: CatalogDetail }) {
  return (
    <div className="detail-media-column">
      <section className="detail-preview" aria-label={`${item.item.title} book cover`}>
        <div className="detail-preview-top">
          <span><Sparkles size={13} aria-hidden="true" /> THE LITTLE DETAILS</span>
          <span>PIXINIUM / {item.category.name.toUpperCase()}</span>
        </div>
        <div className="detail-art story-detail-art" style={{ backgroundColor: item.item.accentColor }}>
          <StoryBookCover accentColor={item.item.accentColor} cover={item.cover} />
        </div>
      </section>
    </div>
  )
}
