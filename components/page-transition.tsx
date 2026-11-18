'use client'

import { ViewTransition, type ComponentProps } from 'react'

// Keep the existing main element and its layout; only its contents crossfade.
// The shared name also connects route skeletons to the resolved page.
export function PageTransition({ className = '', children, ...props }: ComponentProps<'main'>) {
  return <ViewTransition name="page-content" default="page-crossfade">
    <main {...props} className={`page-surface ${className}`}>
      {children}
    </main>
  </ViewTransition>
}
