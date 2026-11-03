import { BrandLogo } from '@/components/brand-logo'
import { PolicyLinks } from '@/components/policy-links'

export function SiteFooter() {
  return <footer className="home-footer home-shell site-footer">
    <div className="site-footer-brand"><BrandLogo className="brand-logo-footer" /><p>A little archive. A lot to love.</p></div>
    <PolicyLinks />
  </footer>
}
