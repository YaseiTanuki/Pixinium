import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { BrandLogo } from '@/components/brand-logo'
import '../(account)/account.css'

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <div className="home-page account-page">
    <a className="skip-home" href="#account-main">Skip to content</a>
    <SiteHeader />
    <main id="account-main" className="account-shell profile-route-shell">
      <section className="account-card">{children}</section>
    </main>
    <footer className="home-footer home-shell">
      <BrandLogo className="brand-logo-footer" />
      <p>A little archive. A lot to love.</p>
      <Link href="/search">Explore the archive</Link>
    </footer>
  </div>
}
