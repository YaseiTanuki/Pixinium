'use client'

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

const PendingContext = createContext<(id: string, pending: boolean) => void>(() => {})
export function NavigationTransitionProvider({ children }: { children: ReactNode }) {
  const pending = useRef(new Set<string>())
  const status = useRef<HTMLSpanElement>(null)
  const report = useCallback((id: string, active: boolean) => {
    if (pending.current.has(id) === active) return
    if (active) pending.current.add(id)
    else pending.current.delete(id)
    const navigating = pending.current.size > 0
    // Feedback must not schedule an urgent React render: that can interrupt
    // the router's native view transition, especially in production builds.
    document.documentElement.dataset.navigating = String(navigating)
    document.querySelector('main')?.setAttribute('aria-busy', String(navigating))
    if (status.current) status.current.textContent = navigating ? 'Loading page...' : ''
  }, [])
  useEffect(() => () => {
    delete document.documentElement.dataset.navigating
    document.querySelector('main')?.removeAttribute('aria-busy')
  }, [])
  return <PendingContext.Provider value={report}>
    {children}
    <span ref={status} className="sr-only" role="status" aria-live="polite" aria-atomic="true" />
  </PendingContext.Provider>
}

export function useNavigationPending(pending: boolean) {
  const report = useContext(PendingContext)
  const id = useId()
  useEffect(() => {
    report(id, pending)
    return () => report(id, false)
  }, [id, pending, report])
}

// Programmatic navigation shares the same feedback as links, including filters.
export function useNavigationRouter() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  useNavigationPending(pending)
  return useMemo(() => ({
    ...router,
    push: (...args: Parameters<typeof router.push>) => startTransition(() => router.push(...args)),
    replace: (...args: Parameters<typeof router.replace>) => startTransition(() => router.replace(...args)),
  }), [router])
}
