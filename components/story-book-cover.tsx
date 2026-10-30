import { BookOpen } from 'lucide-react'

type Props = {
  accentColor: string
  cover: { url: string; altText: string; focalX: number; focalY: number; width?: number | null; height?: number | null } | null
  loading?: 'eager' | 'lazy'
}

export function StoryBookCover({ accentColor, cover, loading = 'eager' }: Props) {
  return <div className="story-book-object">
    <span className="story-book-pages" aria-hidden="true" />
    <div className="story-book-face" style={{ backgroundColor: accentColor }}>
      {cover ? <img src={cover.url} alt={cover.altText} width={cover.width || 720} height={cover.height || 1000} loading={loading} fetchPriority={loading === 'eager' ? 'high' : 'auto'} style={{ objectPosition: `${cover.focalX}% ${cover.focalY}%` }} /> : <BookOpen className="story-book-fallback" size={54} aria-hidden="true" />}
    </div>
  </div>
}
