'use client'

import Link, { useLinkStatus } from 'next/link'
import { forwardRef, type ComponentProps } from 'react'
import { useNavigationPending } from '@/components/navigation-transition'

function LinkPending() {
  const { pending } = useLinkStatus()
  useNavigationPending(pending)
  return null
}

const NavigationLink = forwardRef<HTMLAnchorElement, ComponentProps<typeof Link>>(function NavigationLink({ children, ...props }, ref) {
  return <Link {...props} ref={ref}>{children}<LinkPending /></Link>
})

export default NavigationLink
