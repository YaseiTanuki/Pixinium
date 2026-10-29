'use client'



import Link from 'next/link'
import { Image as ImageIcon, Music2 } from 'lucide-react'
import { categoryHref, itemHref } from '@/lib/catalog'
import type { CatalogCard as Card } from '@/lib/entities/catalog'
import { categoryIcon } from '@/lib/category-icons'
import { CollectButton } from '@/components/collect-button'

export function ItemArtwork({ item }: { item: Card }) {
  return <div className="item-artwork" style={{ backgroundColor: item.item.accentColor }}>
    {item.cover ? <img src={item.cover.url} alt={item.cover.altText} width={item.cover.width ?? 600} height={item.cover.height ?? 400} loading="lazy" className="h-full w-full object-cover" style={{ objectPosition: `${item.cover.focalX}% ${item.cover.focalY}%` }} /> : item.category.artworkStyle === 'record' ? <div className="record-art" aria-hidden="true"><div className="record-disc"><span><Music2 size={25} /></span></div><span className="record-caption">PIXINIUM RECORDS / SIDE B</span></div> : <ImageIcon size={36} aria-label="No cover artwork" />}
  </div>
}

export function CatalogCard({ item, variant = 'compact' }: { item: Card; variant?: 'compact' | 'detailed' }) {
  const Icon = categoryIcon(item.category.iconKey)
  return <article className={`discovery-card discovery-card-${variant}`}>
    <div className="relative">
      <Link className="artwork-button" href={itemHref(item)} aria-label={`View ${item.item.title}`}><ItemArtwork item={item} /></Link>
      {variant === 'compact' && <CollectButton item={item} className="save-item" />}
    </div>
    <div className="discovery-card-copy">
      <h3><Link href={itemHref(item)}>{item.item.title}</Link></h3>
      {variant === 'detailed' && <>
        <div className="discovery-card-bottom"><Link href={categoryHref(item.category.slug)} className="card-category-link"><Icon size={15} aria-hidden="true" />{item.category.name}</Link><CollectButton item={item} showCount /></div>
      </>}
    </div>
  </article>
}
