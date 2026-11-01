'use client'

import { useCallback, useState } from 'react'
import { ImageOff } from 'lucide-react'
import type { CatalogCard } from '@/lib/entities/catalog'
import './artwork-image.css'

export function ArtworkImage({ cover, title }: { cover: NonNullable<CatalogCard['cover']>; title: string }) {
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading')
  // Cached images (or failures) can finish before React attaches load handlers.
  const imageRef = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete) setState(image.naturalWidth > 0 ? 'loaded' : 'error')
  }, [])

  return <span className="artwork-media" data-state={state} aria-busy={state === 'loading'}>
    <img ref={imageRef} src={cover.url} alt={cover.altText || title} aria-hidden={state === 'error' ? true : undefined}
      width={cover.width && cover.width > 0 ? cover.width : 600}
      height={cover.height && cover.height > 0 ? cover.height : 400}
      loading="lazy" decoding="async"
      onLoad={() => setState('loaded')} onError={() => setState('error')}
      style={{ width: '100%', height: '100%', opacity: state === 'loaded' ? 1 : 0, objectPosition: `${cover.focalX}% ${cover.focalY}%` }} />
    {state === 'loading' && <span className="artwork-skeleton" aria-hidden="true" />}
    {state === 'error' && <span className="artwork-unavailable" role="img" aria-label={`Preview unavailable: ${title}`}><ImageOff size={24} aria-hidden="true" /><span aria-hidden="true">Preview unavailable</span></span>}
  </span>
}
