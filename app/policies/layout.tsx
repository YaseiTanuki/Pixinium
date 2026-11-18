import { PageTransition } from '@/components/page-transition'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import './policies.css'

export default function PoliciesLayout({ children }: { children: React.ReactNode }) {
  return <div className="home-page policy-page">
    <a className="skip-home" href="#policy-main">Skip to content</a>
    <SiteHeader />
    <PageTransition id="policy-main" className="policy-shell">{children}</PageTransition>
    <SiteFooter />
  </div>
}
