'use client'

import { useRef } from 'react'
import { Maximize2, Sparkles, X } from 'lucide-react'
import type { CatalogDetail } from '@/lib/entities/catalog'

export function ArtworkViewer({ cover, title, category }: {
  cover: NonNullable<CatalogDetail['cover']>
  title: string
  category: string
}) {
  const dialog = useRef<HTMLDialogElement>(null)

  return (
    <figure className="artwork-gallery">
      <div className="artwork-stage">
        <img className="artwork-ambience" src={cover.url} alt="" aria-hidden="true" />
        <div className="artwork-gallery-label"><Sparkles size={13} aria-hidden="true" /> A LITTLE FIND. A LOT TO LOVE.</div>
        <button className="artwork-open" type="button" onClick={() => dialog.current?.showModal()} aria-label={`View ${title} fullscreen`} aria-haspopup="dialog">
          <img className="artwork-image" src={cover.url} alt={cover.altText || title} width={cover.width || 1600} height={cover.height || 1000} fetchPriority="high" />
          <span className="artwork-expand"><Maximize2 size={15} aria-hidden="true" /> View fullscreen</span>
        </button>
      </div>
      <figcaption className="artwork-caption"><span>{category} <span aria-hidden="true">/</span> Preview</span><span>Made for a closer look <Maximize2 size={12} aria-hidden="true" /></span></figcaption>
      <dialog ref={dialog} className="artwork-dialog" aria-label={title} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }}>
        <button type="button" className="artwork-close" onClick={() => dialog.current?.close()} aria-label="Close fullscreen preview" autoFocus><X size={22} /></button>
        <img src={cover.url} alt={cover.altText || title} />
        <p>{title}</p>
      </dialog>
    </figure>
  )
}
