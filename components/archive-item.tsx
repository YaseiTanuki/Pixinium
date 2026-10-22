'use client'

import { ArchiveImage } from '@/components/archive-image'

import Link from 'next/link'
import { ArrowUpRight, Heart, Music2 } from 'lucide-react'
import { itemHref, type ArchiveItem } from '@/lib/archive'
import { useSavedItems } from '@/lib/saved-items'

export function ItemArtwork({ item }: { item: ArchiveItem }) {
  return <div className={`item-artwork ${item.color}`}>
    {item.image ? <ArchiveImage src={item.image} alt="" width={600} height={400} loading="lazy" className={`h-full w-full object-cover ${item.crop}`} /> : <div className="record-art" aria-hidden="true"><div className="record-disc"><span><Music2 size={25} /></span></div><span className="record-caption">PIXINIUM RECORDS / SIDE B</span></div>}
  </div>
}

export function ArchiveCard({ item }: { item: ArchiveItem }) {
  const { saved, toggleSaved } = useSavedItems()
  const isSaved = saved.includes(item.title)
  return <article className="discovery-card">
    <div className="relative">
      <Link className="artwork-button" href={itemHref(item)} aria-label={`View ${item.title}`}><ItemArtwork item={item} /></Link>
      <span className="item-category">{item.category}</span>
      <button className={`save-item ${isSaved ? 'is-saved' : ''}`} onClick={() => toggleSaved(item.title)} aria-label={`${isSaved ? 'Unsave' : 'Save'} ${item.title}`} aria-pressed={isSaved}><Heart size={16} fill={isSaved ? 'currentColor' : 'none'} /></button>
    </div>
    <div className="discovery-card-copy"><h3><Link href={itemHref(item)}>{item.title}</Link></h3><p>{item.meta}</p><div className="discovery-card-bottom"><span>PIXINIUM PICK</span><Link href={itemHref(item)}>Take a look <ArrowUpRight size={14} aria-hidden="true" /></Link></div></div>
  </article>
}
