import type { ReactNode } from 'react'

// Keep the surrounding banner, filters and pagination mounted while loading.
export function NavigationResults({ children }: { children: ReactNode }) {
  return <div className="navigation-results" data-navigation-results>
    <div className="list-pending-skeleton" aria-hidden="true">
      <div className="route-skeleton-grid">{Array.from({ length: 6 }, (_, index) => <span key={index} />)}</div>
    </div>
    <div className="list-ready-content">{children}</div>
  </div>
}
