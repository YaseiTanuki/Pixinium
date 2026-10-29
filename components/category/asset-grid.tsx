import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { ItemArtwork } from '@/components/catalog-card'
import { CollectButton } from '@/components/collect-button'
import { itemHref } from '@/lib/catalog'
import type { CatalogDetail } from '@/lib/entities/catalog'

export function AssetGrid({ items }: { items: CatalogDetail[] }) {
  return <div className="category-asset-grid">{items.map(item => <article className="category-asset-card" key={item.item.id}>
    <Link className="asset-card-art" href={itemHref(item)} aria-label={`Explore ${item.item.title}`}><ItemArtwork item={item} /></Link>
    <div className="category-card-body"><h2><Link href={itemHref(item)}>{item.item.title}</Link></h2>
      {item.item.summary && <p>{item.item.summary}</p>}
      <dl className="asset-card-facts">{item.facts.slice(0, 3).map(fact => <div key={fact.key}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>
      <div className="category-card-footer"><Link href={itemHref(item)}>Explore <ArrowUpRight size={15} aria-hidden="true" /></Link><CollectButton item={item} showCount /></div>
    </div>
  </article>)}</div>
}
