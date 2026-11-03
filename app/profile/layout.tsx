import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import '../(account)/account.css'
export const metadata = { title: 'Your profile', robots: { index: false, follow: false } }

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <div className="home-page account-page">
    <a className="skip-home" href="#account-main">Skip to content</a>
    <SiteHeader />
    <main id="account-main" className="account-shell profile-route-shell">
      <section className="account-card">{children}</section>
    </main>
    <SiteFooter />
  </div>
}
