'use client'

import { useSyncExternalStore } from 'react'

const key = 'pixinium:saved-catalog-ids'
const empty: string[] = []
let cachedRaw: string | null = null
let cachedItems = empty

function snapshot() {
  try {
    const raw = localStorage.getItem(key)
    if (raw !== cachedRaw) {
      const value: unknown = raw ? JSON.parse(raw) : []
      cachedItems = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : empty
      cachedRaw = raw
    }
    return cachedItems
  } catch {
    return cachedItems
  }
}

function subscribe(notify: () => void) {
  window.addEventListener('storage', notify)
  window.addEventListener('pixinium-saved', notify)
  return () => {
    window.removeEventListener('storage', notify)
    window.removeEventListener('pixinium-saved', notify)
  }
}

export function useSavedItems() {
  const saved = useSyncExternalStore(subscribe, snapshot, () => empty)
  function toggleSaved(id: string) {
    const current = snapshot()
    cachedItems = current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    try {
      const raw = JSON.stringify(cachedItems)
      localStorage.setItem(key, raw)
      cachedRaw = raw
    } catch {
      // Keep the collection available for this session if storage is disabled.
    }
    window.dispatchEvent(new Event('pixinium-saved'))
  }
  return { saved, toggleSaved }
}
