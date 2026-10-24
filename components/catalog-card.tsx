'use client'



import Link from 'next/link'
import { ArrowUpRight, Heart, Image as ImageIcon, Music2 } from 'lucide-react'
import { itemHref } from '@/lib/catalog'
import type { CatalogCard as Card } from '@/lib/entities/catalog'
import { useSavedItems } from '@/lib/saved-items'

export function ItemArtwork({ item }: { item: Card }) {
  return <div className="item-artwork" style={{ backgroundColor: item.item.accentColor }}>
    {item.cover ? <img src={item.cover.url} alt={item.cover.altText} width={600} height={400} loading="lazy" className="h-full w-full object-cover" style={{ objectPosition: `${item.cover.focalX}% ${item.cover.focalY}%` }} /> : item.category.artworkStyle === 'record' ? <div className="record-art" aria-hidden="true"><div className="record-disc"><span><Music2 size={25} /></span></div><span className="record-caption">PIXINIUM RECORDS / SIDE B</span></div> : <ImageIcon size={36} aria-label="No cover artwork" />}
  </div>
}

export function CatalogCard({ item }: { item: Card }) {
  const { saved, toggleSaved } = useSavedItems()
  const isSaved = saved.includes(item.item.id)
  return <article className="discovery-card">
    <div className="relative">
      <Link className="artwork-button" href={itemHref(item)} aria-label={`View ${item.item.title}`}><ItemArtwork item={item} /></Link>
      <span className="item-category">{item.category.name}</span>
      <button className={`save-item ${isSaved ? 'is-saved' : ''}`} onClick={() => toggleSaved(item.item.id)} aria-label={`${isSaved ? 'Unsave' : 'Save'} ${item.item.title}`} aria-pressed={isSaved}><Heart size={16} fill={isSaved ? 'currentColor' : 'none'} /></button>
    </div>
    <div className="discovery-card-copy"><h3><Link href={itemHref(item)}>{item.item.title}</Link></h3><p>{item.item.summary || item.facts.map(fact => fact.value).join(' ? ')}</p><div className="discovery-card-bottom"><span>{item.item.isFeatured ? 'PIXINIUM PICK' : item.category.name}</span><Link href={itemHref(item)}>Take a look <ArrowUpRight size={14} aria-hidden="true" /></Link></div></div>
  </article>
}
