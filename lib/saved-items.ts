'use client'

import { useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { loadSavedItems, setItemCollected } from '@/app/actions/saved-items'

const initial = { saved: [] as string[], pending: false, loaded: false, error: '' }
let state = initial
let generation = 0
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()
let stop: (() => void) | undefined

function update(next: Partial<typeof state>) {
  state = { ...state, ...next }
  listeners.forEach(notify => notify())
}

function refresh() {
  if (loading || state.pending) return loading ?? Promise.resolve()
  const version = generation
  const request = (async () => {
    try {
      const result = await loadSavedItems()
      if (version !== generation) return
      update({ ...(result.ids ? { saved: result.ids } : {}), loaded: true, error: result.error ?? '' })
    } catch {
      if (version === generation) update({ loaded: true, error: 'Could not load your collection. Please try again.' })
    }
  })()
  loading = request
  void request.finally(() => { if (loading === request) loading = null })
  return request
}

function subscribe(notify: () => void) {
  listeners.add(notify)
  if (listeners.size === 1) {
    let userId: string | null | undefined
    let timer: ReturnType<typeof setTimeout>
    const reload = () => { void refresh() }
    const { data } = createClient().auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user.id ?? null
      if (nextUser === userId) return
      userId = nextUser
      generation++
      loading = null
      update({ ...initial })
      // Run outside the auth callback to avoid holding the auth client's lock.
      clearTimeout(timer)
      timer = setTimeout(reload, 0)
    })
    window.addEventListener('focus', reload)
    stop = () => {
      clearTimeout(timer)
      data.subscription.unsubscribe()
      window.removeEventListener('focus', reload)
      generation++
      loading = null
    }
  }
  return () => {
    listeners.delete(notify)
    if (!listeners.size) { stop?.(); stop = undefined }
  }
}

const snapshot = () => state
const serverSnapshot = () => initial

export function useSavedItems() {
  const router = useRouter()
  const current = useSyncExternalStore(subscribe, snapshot, serverSnapshot)
  async function toggleSaved(id: string) {
    if (state.pending) return
    const beforeLoad = generation
    await refresh()
    if (beforeLoad !== generation || state.pending || state.error) return
    const version = generation
    update({ pending: true, error: '' })
    try {
      const result = await setItemCollected({ id, saved: !state.saved.includes(id) })
      if (version !== generation) return
      if (result.loginRequired) { router.push('/login?reason=collect'); return }
      update({ ...(result.ids ? { saved: result.ids } : {}), error: result.error ?? '' })
    } catch {
      if (version === generation) update({ error: 'Could not update your collection. Please try again.' })
    } finally {
      if (version === generation) update({ pending: false })
    }
  }
  return { ...current, toggleSaved }
}
