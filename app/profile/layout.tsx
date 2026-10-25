import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import '../(account)/account.css'

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <div className="home-page account-page">
    <a className="skip-home" href="#account-main">Skip to content</a>
    <SiteHeader />
    <main id="account-main" className="account-shell profile-route-shell">
      <section className="account-card">{children}</section>
    </main>
    <footer className="home-footer home-shell">
      <Link href="/" className="footer-logo">pixinium<span>.</span></Link>
      <p>A little archive. A lot to love.</p>
      <Link href="/search">Explore the archive</Link>
    </footer>
  </div>
}
