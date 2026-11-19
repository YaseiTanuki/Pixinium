'use client'

import type { ComponentProps } from 'react'
import { useNavigationRouter } from '@/components/navigation-transition'

// GET searches share the same immediate skeleton as links and filters.
export function NavigationForm({ action, onSubmit, ...props }: Omit<ComponentProps<'form'>, 'action' | 'method'> & { action: string }) {
  const router = useNavigationRouter()
  return <form {...props} action={action} method="get" onSubmit={event => {
    onSubmit?.(event)
    if (event.defaultPrevented || (event.currentTarget.target && event.currentTarget.target !== '_self')) return
    const destination = new URL(action, window.location.href)
    if (destination.origin !== window.location.origin) return
    event.preventDefault()
    destination.search = ''
    const values = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter)
    for (const [name, value] of values) destination.searchParams.append(name, typeof value === 'string' ? value : value.name)
    router.push(`${destination.pathname}${destination.search}${destination.hash}`)
  }} />
}
