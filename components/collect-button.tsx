'use client'

import { useEffect, useRef, useState } from 'react'
import { Heart } from 'lucide-react'
import { useSavedItems } from '@/lib/saved-items'
import type { CatalogCard } from '@/lib/entities/catalog'

export function CollectButton({ item, showCount = false, className = '' }: { item: CatalogCard; showCount?: boolean; className?: string }) {
  const { saved, toggleSaved, pending, loaded } = useSavedItems()
  const isSaved = saved.includes(item.item.id)
  const [count, setCount] = useState(item.collectCount ?? 0)
  const previous = useRef<boolean | null>(null)
  useEffect(() => {
    setCount(item.collectCount ?? 0)
    previous.current = null
  }, [item.item.id, item.collectCount])
  useEffect(() => {
    if (!loaded) { previous.current = null; return }
    if (previous.current !== null && previous.current !== isSaved) {
      setCount(value => Math.max(0, value + (isSaved ? 1 : -1)))
    }
    previous.current = isSaved
  }, [isSaved, loaded])
  return <button type="button" className={`collect-button ${className} ${isSaved ? 'is-saved' : ''}`}
    onClick={() => void toggleSaved(item.item.id)} aria-pressed={isSaved} disabled={pending} aria-busy={pending}
    aria-label={`${isSaved ? 'Remove from collection:' : 'Collect'} ${item.item.title}${showCount ? `; ${count} collects` : ''}`}>
    <Heart size={16} fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
    {showCount && <span>{count.toLocaleString('en')}<span className="collect-label"> collects</span></span>}
  </button>
}
