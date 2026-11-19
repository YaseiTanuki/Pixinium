'use client'

import Link, { useLinkStatus } from 'next/link'
import { usePathname } from 'next/navigation'
import { forwardRef, useRef, type ComponentProps } from 'react'
import { useNavigationPending, useNavigationStart } from '@/components/navigation-transition'

function LinkPending({ id }: { id: string }) {
  const { pending } = useLinkStatus()
  useNavigationPending(pending, id)
  return null
}

const NavigationLink = forwardRef<HTMLAnchorElement, ComponentProps<typeof Link>>(function NavigationLink({ children, onNavigate, ...props }, ref) {
  const anchor = useRef<HTMLAnchorElement>(null)
  const navigation = useNavigationStart()
  const pathname = usePathname()
  const href = typeof props.href === 'string' ? new URL(props.href, `https://navigation.invalid${pathname ?? '/'}`) : props.href
  const samePage = (href.pathname ?? pathname) === pathname && !href.hash
  return <Link {...props} scroll={props.scroll ?? (samePage ? false : undefined)} ref={node => {
    anchor.current = node
    if (typeof ref === 'function') return ref(node)
    if (ref) ref.current = node
  }} onNavigate={event => {
    let prevented = false
    onNavigate?.({ preventDefault: () => { prevented = true; event.preventDefault() } })
    if (!prevented) navigation.start({ from: window.location.href, to: anchor.current?.href ?? window.location.href })
  }}>{children}<LinkPending id={navigation.id} /></Link>
})

export default NavigationLink
