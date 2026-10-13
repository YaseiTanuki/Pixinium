'use client'

import { ArchiveImage } from '@/components/archive-image'

import { useEffect, useRef } from 'react'
import { ArrowUpRight, Heart, Music2, X } from 'lucide-react'
import { type ArchiveItem } from '@/lib/archive'
import { useSavedItems } from '@/lib/saved-items'

export function ItemArtwork({ item }: { item: ArchiveItem }) {
  return <div className={`item-artwork ${item.color}`}>
    {item.image ? <ArchiveImage src={item.image} alt="" width={600} height={400} loading="lazy" className={`h-full w-full object-cover ${item.crop}`} /> : <div className="record-art" aria-hidden="true"><div className="record-disc"><span><Music2 size={25} /></span></div><span className="record-caption">PIXINIUM RECORDS / SIDE B</span></div>}
  </div>
}

export function ArchiveCard({ item, onOpen }: { item: ArchiveItem; onOpen: () => void }) {
  const { saved, toggleSaved } = useSavedItems()
  const isSaved = saved.includes(item.title)
  return <article className="discovery-card">
    <div className="relative">
      <button className="artwork-button" onClick={onOpen} aria-label={`Preview ${item.title}`}><ItemArtwork item={item} /></button>
      <span className="item-category">{item.category}</span>
      <button className={`save-item ${isSaved ? 'is-saved' : ''}`} onClick={() => toggleSaved(item.title)} aria-label={`${isSaved ? 'Unsave' : 'Save'} ${item.title}`} aria-pressed={isSaved}><Heart size={16} fill={isSaved ? 'currentColor' : 'none'} /></button>
    </div>
    <div className="discovery-card-copy"><h3><button onClick={onOpen}>{item.title}</button></h3><p>{item.meta}</p><div className="discovery-card-bottom"><span>PIXINIUM PICK</span><button onClick={onOpen}>Take a look <ArrowUpRight size={14} aria-hidden="true" /></button></div></div>
  </article>
}

export function ItemPreview({ item, onClose }: { item: ArchiveItem | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const { saved, toggleSaved } = useSavedItems()
  useEffect(() => {
    if (!item) return
    const element = dialog.current
    element?.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { element?.close(); document.body.style.overflow = previous }
  }, [item])
  if (!item) return null
  const isSaved = saved.includes(item.title)
  return <dialog ref={dialog} className="item-preview" aria-labelledby="preview-title" onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className="relative"><ItemArtwork item={item} /><button autoFocus className="preview-close" onClick={onClose} aria-label="Close preview"><X size={20} /></button></div>
    <div className="preview-copy"><p className="eyebrow">{item.category} / Pixinium pick</p><h2 id="preview-title">{item.title}</h2><p>{item.meta}</p><p className="preview-note">A little find for your collection. Save it here to come back to it whenever the mood strikes.</p><button className="primary-button" onClick={() => toggleSaved(item.title)} aria-pressed={isSaved}><Heart size={17} fill={isSaved ? 'currentColor' : 'none'} />{isSaved ? 'Saved to your collection' : 'Save to your collection'}</button></div>
  </dialog>
}
