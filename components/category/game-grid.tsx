import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { ItemArtwork } from '@/components/catalog-card'
import { CollectButton } from '@/components/collect-button'
import { itemHref } from '@/lib/catalog'
import type { CatalogDetail } from '@/lib/entities/catalog'

export function GameGrid({ items }: { items: CatalogDetail[] }) {
  return <div className="category-game-grid">{items.map(item => <article className="category-game-card" key={item.item.id}>
    <Link className="game-card-art" href={itemHref(item)} aria-label={`Explore ${item.item.title}`}><ItemArtwork item={item} /><span className="game-card-open"><ArrowUpRight size={20} aria-hidden="true" /></span></Link>
    <div className="category-card-body"><h2><Link href={itemHref(item)}>{item.item.title}</Link></h2>
      <div className="category-card-footer"><div className="category-tags">{item.tags.slice(0, 3).map(tag => <span key={tag.id}>{tag.name}</span>)}</div><CollectButton item={item} /></div>
    </div>
  </article>)}</div>
}
