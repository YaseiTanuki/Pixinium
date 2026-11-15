'use client'

import { useState } from 'react'
import { PLAYABLE_GAME_TAG } from '@/lib/admin/game'

export function GameTagsField({ tags = [] }: { tags?: string[] }) {
  const [value, setValue] = useState(tags.join(', '))
  const values = value.split(',').map(tag => tag.trim()).filter(Boolean)
  const playable = values.some(tag => tag.toLowerCase() === PLAYABLE_GAME_TAG.name)
  return <div className="studio-full">
    <label>Tags<input className="account-input" name="tags" value={value} onChange={event => setValue(event.target.value)} maxLength={1000} /></label>
    <label><span><input type="checkbox" checked={playable} onChange={event => setValue([
      ...values.filter(tag => tag.toLowerCase() !== PLAYABLE_GAME_TAG.name),
      ...(event.target.checked ? [PLAYABLE_GAME_TAG.name] : []),
    ].join(', '))} /> Play in browser</span></label>
    <span className="account-help">The “play able” tag enables the player for SWF files. ZIP uploads are download only.</span>
  </div>
}
