'use client'

import type { ComponentProps } from 'react'

// All navigation uses skeletons, including pagination.
// No ViewTransition boundary: skeleton and resolved content switch directly.
export function PageTransition({ className = '', children, loading = false, ...props }: ComponentProps<'main'> & { loading?: boolean }) {
  return <main {...props} className={`page-surface ${className}`} data-route-skeleton={loading || undefined}>
      {!loading && <div className="route-pending-skeleton" aria-hidden="true">
        <div className="route-skeleton-panel">
        <span className="route-skeleton-title" /><span className="route-skeleton-line" />
        <div className="route-skeleton-grid">{Array.from({ length: 6 }, (_, index) => <span key={index} />)}</div>
        </div>
      </div>}
      {children}
    </main>
}
