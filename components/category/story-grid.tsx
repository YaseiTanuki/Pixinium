import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import { CollectButton } from '@/components/collect-button'
import { StoryBookCover } from '@/components/story-book-cover'
import { itemHref } from '@/lib/catalog'
import type { CatalogDetail } from '@/lib/entities/catalog'
import '@/components/story-book.css'

export function StoryGrid({ items }: { items: CatalogDetail[] }) {
  return <div className="category-story-grid">{items.map(item => {
    const href = itemHref(item)
    const excerpt = item.description || item.item.summary
    return <article className="category-story-card" key={item.item.id}>
      <Link className="story-book-link" href={href} aria-label={`Read ${item.item.title}`}>
        <StoryBookCover accentColor={item.item.accentColor} cover={item.cover} loading="lazy" />
      </Link>
      <div className="story-card-copy">
        <h2><Link href={href}>{item.item.title}</Link></h2>
        {excerpt && <p className="story-card-excerpt">{excerpt}</p>}
        <div className="story-card-actions">
          <p className="story-card-meta"><BookOpen size={13} aria-hidden="true" /> {item.chapterCount ?? 0} {(item.chapterCount ?? 0) === 1 ? 'chapter' : 'chapters'}</p>
          <CollectButton item={item} />
        </div>
      </div>
    </article>
  })}</div>
}
