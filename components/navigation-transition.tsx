'use client'

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { navigationFeedback, type NavigationFeedback } from '@/lib/navigation-feedback'

export type NavigationTarget = { from: string; to: string }
const PendingContext = createContext<(id: string, effect: NavigationFeedback, target?: NavigationTarget) => void>(() => {})
export function NavigationTransitionProvider({ children }: { children: ReactNode }) {
  const pending = useRef(new Map<string, NavigationFeedback>())
  const status = useRef<HTMLSpanElement>(null)
  const paginationAnchor = useRef<number | null>(null)
  const optimisticPage = useRef<{ owner: string; nav: HTMLElement; link: HTMLAnchorElement } | null>(null)
  const clearOptimisticPage = useCallback(() => {
    if (!optimisticPage.current) return
    delete optimisticPage.current.nav.dataset.paginationPending
    delete optimisticPage.current.link.dataset.paginationTarget
    optimisticPage.current.link.removeAttribute('aria-busy')
    optimisticPage.current = null
  }, [])
  const report = useCallback((id: string, effect: NavigationFeedback, target?: NavigationTarget) => {
    const main = document.querySelector('main')
    const results = main?.querySelector('[data-navigation-results]')
    // Query updates must never replace a stable page shell. Screens without
    // an async results region retain their existing local pending feedback.
    if ((effect === 'list-skeleton' || effect === 'pagination-skeleton') && !results) effect = 'none'
    const pagination = main?.querySelector<HTMLElement>('.archive-pagination')
    if (effect === 'pagination-skeleton' && target && pagination) {
      clearOptimisticPage()
      const page = new URL(target.to, target.from).searchParams.get('page') ?? '1'
      const link = [...pagination.querySelectorAll<HTMLAnchorElement>('.archive-page-numbers a')]
        .find(candidate => (new URL(candidate.href).searchParams.get('page') ?? '1') === page)
      if (link) {
        pagination.dataset.paginationPending = 'true'
        link.dataset.paginationTarget = 'true'
        link.setAttribute('aria-busy', 'true')
        optimisticPage.current = { owner: id, nav: pagination, link }
      }
    } else if ((effect !== 'none') || optimisticPage.current?.owner === id) {
      clearOptimisticPage()
    }
    if ((pending.current.get(id) ?? 'none') === effect) return
    if (effect === 'pagination-skeleton' && pagination && results) {
      // Keep the control at its current viewport position while the list
      // changes height, without competing with browser scroll anchoring.
      paginationAnchor.current = pagination.getBoundingClientRect().top
      document.documentElement.dataset.paginationAnchor = 'true'
      results.setAttribute('data-pagination-stable', '')
    } else if (effect === 'skeleton' || effect === 'list-skeleton') {
      paginationAnchor.current = null
      delete document.documentElement.dataset.paginationAnchor
      results?.removeAttribute('data-pagination-stable')
      if (results instanceof HTMLElement) results.style.removeProperty('min-height')
    }
    pending.current.delete(id)
    if (effect !== 'none') pending.current.set(id, effect)
    const navigating = pending.current.size > 0
    const previousScroll = window.scrollY
    const mainTop = main ? main.getBoundingClientRect().top + previousScroll : 0
    // The most recent active navigation owns feedback. Never layer effects.
    document.documentElement.dataset.navigating = String(navigating)
    const activeEffect = [...pending.current.values()].at(-1) ?? 'none'
    document.documentElement.dataset.navigationEffect = activeEffect
    main?.setAttribute('aria-busy', String(activeEffect === 'skeleton'))
    results?.setAttribute('aria-busy', String(activeEffect === 'list-skeleton' || activeEffect === 'pagination-skeleton'))
    if (main && activeEffect === 'skeleton' && effect !== 'none') {
      // The old content leaves layout entirely. Move a deep scroll position
      // to the compact skeleton instead of leaving a tall blank region.
      if (previousScroll > mainTop - 24) window.scrollTo({ top: Math.max(0, mainTop - 24), behavior: 'instant' })
    } else if (!navigating) {
      // Grids may have received new items while display:none. Measure them
      // synchronously on reveal so cards do not overlap for the first frame.
      window.dispatchEvent(new Event('pixinium:navigation-ready'))
    }
    if (paginationAnchor.current !== null && pagination) {
      // On short pages the requested anchor can lie below the control's
      // document position. Reserve only enough list space to make it reachable.
      const missingSpace = paginationAnchor.current - pagination.getBoundingClientRect().top - window.scrollY
      if (missingSpace > 0.5 && results instanceof HTMLElement) {
        results.style.minHeight = `${results.getBoundingClientRect().height + missingSpace}px`
      }
      const adjustment = pagination.getBoundingClientRect().top - paginationAnchor.current
      if (Math.abs(adjustment) > 0.5) window.scrollBy({ top: adjustment, behavior: 'instant' })
    }
    if (!navigating) {
      clearOptimisticPage()
      paginationAnchor.current = null
      requestAnimationFrame(() => {
        if (paginationAnchor.current === null) delete document.documentElement.dataset.paginationAnchor
      })
    }
    if (status.current) status.current.textContent = navigating ? 'Loading page...' : ''
  }, [clearOptimisticPage])
  useEffect(() => {
    const rememberScroll = () => {
      if (paginationAnchor.current === null) return
      const pagination = document.querySelector('.archive-pagination')
      if (pagination) paginationAnchor.current = pagination.getBoundingClientRect().top
    }
    window.addEventListener('scroll', rememberScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', rememberScroll)
      delete document.documentElement.dataset.navigating
      delete document.documentElement.dataset.navigationEffect
      delete document.documentElement.dataset.paginationAnchor
      document.querySelector('main')?.removeAttribute('aria-busy')
      document.querySelector('[data-navigation-results]')?.removeAttribute('aria-busy')
      clearOptimisticPage()
    }
  }, [clearOptimisticPage])
  return <PendingContext.Provider value={report}>
    {children}
    <span ref={status} className="sr-only" role="status" aria-live="polite" aria-atomic="true" />
  </PendingContext.Provider>
}

export function useNavigationStart() {
  const report = useContext(PendingContext)
  const id = useId()
  const start = useCallback((target: NavigationTarget) => {
    // Set the skeleton in the click/submit handler, before Next starts work.
    const feedback = navigationFeedback(target.from, target.to)
    report(id, feedback, target)
    return feedback
  }, [id, report])
  return useMemo(() => ({ id, start }), [id, start])
}

export function useNavigationPending(pending: boolean, id: string) {
  const report = useContext(PendingContext)
  useEffect(() => {
    if (!pending) report(id, 'none')
  }, [id, pending, report])
  useEffect(() => () => report(id, 'none'), [id, report])
}

// Programmatic navigation shares the same feedback as links, including filters.
export function useNavigationRouter() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const navigation = useNavigationStart()
  useNavigationPending(pending, navigation.id)
  return useMemo(() => ({
    ...router,
    push: (...args: Parameters<typeof router.push>) => {
      const feedback = navigation.start({ from: window.location.href, to: args[0] })
      const options = feedback === 'list-skeleton' || feedback === 'pagination-skeleton' ? { scroll: false, ...args[1] } : args[1]
      startTransition(() => router.push(args[0], options))
    },
    replace: (...args: Parameters<typeof router.replace>) => {
      const feedback = navigation.start({ from: window.location.href, to: args[0] })
      const options = feedback === 'list-skeleton' || feedback === 'pagination-skeleton' ? { scroll: false, ...args[1] } : args[1]
      startTransition(() => router.replace(args[0], options))
    },
  }), [router, navigation])
}
