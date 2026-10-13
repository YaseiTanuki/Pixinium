'use client'

import { useEffect, useRef, type ComponentPropsWithoutRef } from 'react'

const fallback = '/images/character-fallback.svg'

export function ArchiveImage(props: ComponentPropsWithoutRef<'img'>) {
  const image = useRef<HTMLImageElement>(null)
  function recover(element: HTMLImageElement) {
    if (!element.src.endsWith(fallback)) element.src = fallback
  }
  useEffect(() => {
    const element = image.current
    // An eager image can fail before React attaches its error handler.
    if (element?.complete && element.naturalWidth === 0) recover(element)
  }, [props.src])
  return <img {...props} ref={image} onError={(event) => recover(event.currentTarget)} />
}
