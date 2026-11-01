'use client'



import Link from 'next/link'
import { Download, Eye, Gamepad2, Image as ImageIcon, Music2 } from 'lucide-react'
import { categoryHref, itemHref } from '@/lib/catalog'
import type { CatalogCard as Card } from '@/lib/entities/catalog'
import { categoryIcon } from '@/lib/category-icons'
import { CollectButton } from '@/components/collect-button'

export function ItemArtwork({ item }: { item: Card }) {
  return <div className="item-artwork" style={{ backgroundColor: item.item.accentColor }}>
    {item.cover ? <img src={item.cover.url} alt={item.cover.altText} width={item.cover.width ?? 600} height={item.cover.height ?? 400} loading="lazy" className="h-full w-full object-cover" style={{ objectPosition: `${item.cover.focalX}% ${item.cover.focalY}%` }} /> : item.category.artworkStyle === 'record' ? <div className="record-art" aria-hidden="true"><div className="record-disc"><span><Music2 size={25} /></span></div><span className="record-caption">PIXINIUM RECORDS / SIDE B</span></div> : <ImageIcon size={36} aria-label="No cover artwork" />}
  </div>
}

function compact(value = 0) {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

export function CatalogCard({ item, variant = 'compact' }: { item: Card; variant?: 'compact' | 'detailed' | 'cartridge' }) {
  const Icon = categoryIcon(item.category.iconKey)
  return <article className={`discovery-card discovery-card-${variant}`}>
    {variant === 'cartridge' && <div className="cartridge-shell-top" aria-hidden="true"><span className="cartridge-brand">pixinium<span>.</span></span><span className="cartridge-play"><Gamepad2 size={15} /> PLAY</span></div>}
    <div className={variant === 'cartridge' ? 'relative cartridge-label' : 'relative'}>
      <Link className="artwork-button" href={itemHref(item)} aria-label={`View ${item.item.title}`}><ItemArtwork item={item} /></Link>
      <Link href={categoryHref(item.category.slug)} className="card-category-chip" aria-label={item.category.name} title={item.category.name}><Icon size={15} aria-hidden="true" /></Link>
      <div className="discovery-card-overlay" style={variant === 'cartridge' ? { flexDirection: 'row', alignItems: 'center', gap: 4, padding: '40px 6px 4px' } : undefined}>
        <h3 style={variant === 'cartridge' ? { flex: 1, minWidth: 0, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } : undefined}><Link href={itemHref(item)} title={item.item.title}>{item.item.title}</Link></h3>
        {variant !== 'compact' && <div className="card-stats" style={variant === 'cartridge' ? { flex: 'none', gap: 3, fontSize: 10 } : undefined}>
          <span title="Views" aria-label={`${item.viewCount ?? 0} views`}><Eye size={variant === 'cartridge' ? 12 : 15} aria-hidden="true" />{compact(item.viewCount)}</span>
          <CollectButton item={item} showCount />
          <span title="Downloads" aria-label={`${item.downloadCount ?? 0} downloads`}><Download size={variant === 'cartridge' ? 12 : 15} aria-hidden="true" />{compact(item.downloadCount)}</span>
        </div>}
      </div>
      {variant === 'compact' && <CollectButton item={item} className="save-item" />}
    </div>
    {variant === 'cartridge' && <div className="cartridge-shell-bottom" aria-hidden="true"><span className="cartridge-grip" /><span className="cartridge-contacts">{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</span><span className="cartridge-grip" /></div>}
  </article>
}
