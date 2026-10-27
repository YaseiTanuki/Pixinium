'use client'

import { Check, Heart } from 'lucide-react'
import { useSavedItems } from '@/lib/saved-items'

export function SaveItemButton({ itemId }: { itemId: string }) {
  const { saved, toggleSaved } = useSavedItems()
  const isSaved = saved.includes(itemId)

  return (
    <button
      type="button"
      className={`detail-save ${isSaved ? 'detail-saved' : ''}`}
      onClick={() => toggleSaved(itemId)}
      aria-pressed={isSaved}
    >
      {isSaved ? <Check size={19} aria-hidden="true" /> : <Heart size={19} aria-hidden="true" />}
      {isSaved ? 'Saved on this device' : 'Save on this device'}
    </button>
  )
}
