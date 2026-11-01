'use client'

import { X } from 'lucide-react'
import { searchTags } from '@/lib/search-filters'
import type { Tag } from '@/lib/entities/catalog'

export function TagInput({ value, input, onChange, onInputChange, suggestions, disabled }: {
  value: string; input: string; onChange: (value: string) => void
  onInputChange: (value: string) => void; suggestions: Tag[]; disabled: boolean
}) {
  const selected = searchTags(value)
  const add = (text: string) => {
    onChange(searchTags(`${value} ${text}`).join(' '))
    onInputChange('')
  }

  return <div className="search-filter-field search-tag-field">
    <label className="search-filter-label" htmlFor="search-tag">Tags</label>
    <div className="search-tag-editor">
      {selected.map(tag => <span className="search-tag-token" key={tag}>
        {suggestions.find(option => option.slug === tag)?.name ?? tag}
        <button type="button" aria-label={`Remove draft tag: ${tag}`} disabled={disabled} onClick={() => onChange(selected.filter(value => value !== tag).join(' '))}><X size={12} aria-hidden="true" /></button>
      </span>)}
      <input id="search-tag" value={input} disabled={disabled} autoComplete="off" placeholder={selected.length ? 'Add a tag…' : 'Type tags, e.g. cat moon'}
        onChange={event => {
          const text = event.target.value
          if (!(event.nativeEvent as InputEvent).isComposing && /[\s,]/.test(text)) add(text)
          else onInputChange(text)
        }}
        onBlur={() => { if (input.trim()) add(input) }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return
          if (event.key === 'Enter') { event.preventDefault(); add(input) }
          if (event.key === 'Backspace' && !input) onChange(selected.slice(0, -1).join(' '))
        }} />
    </div>
  </div>
}
