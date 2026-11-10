import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, ChevronRight, SlidersHorizontal, ChevronDown } from 'lucide-react'
import { CategoryNavigation } from '@/components/category-navigation'
import { HomeIntro } from '@/components/home-intro'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import './navigation-skeleton.css'

type SkeletonVariant = 'home' | 'search' | 'detail' | 'account' | 'profile' | 'admin' | 'policy'

function Block({ className = '' }: { className?: string }) {
  return <span className={`navigation-skeleton-block ${className}`} />
}

function HomeSkeleton() {
  return <div className="home-page">
    <SiteHeader />
    <main className="home-shell">
      <HomeIntro loading />
      <div className="feature-grid" aria-hidden="true">
        <div className="feature-main navigation-feature-main"><Block className="navigation-short" /><Block className="navigation-feature-label" /></div>
        <div className="feature-side">
          <div className="feature-music navigation-feature-music"><Block className="navigation-short" /><Block className="navigation-title" /><Block className="navigation-line" /></div>
          <div className="feature-surprise"><Block className="navigation-icon" /><Block className="navigation-line" /><Block className="navigation-short" /></div>
        </div>
      </div>
      <div className="category-grid" aria-hidden="true">{Array.from({ length: 4 }, (_, index) => <div className="category-door" key={index}><Block className="navigation-icon" /><div className="navigation-door-copy"><Block className="navigation-short" /><Block className="navigation-line" /></div></div>)}</div>
      <div className="discover-section"><div className="section-heading"><div><p className="eyebrow">WORTH A LITTLE LOOK</p><h2>Good things, right this way<span>.</span></h2></div><Link href="/search" className="archive-link">Explore the whole archive <ArrowUpRight size={16} aria-hidden="true" /></Link></div><div className="masonry-grid discovery-grid navigation-home-results" aria-hidden="true">{Array.from({ length: 4 }, (_, index) => <Block className="navigation-search-card" key={index} />)}</div></div>
    </main>
    <SiteFooter />
  </div>
}

function SearchSkeleton() {
  return <div className="home-page archive-page">
    <SiteHeader />
    <main className="page-shell catalog-layout">
      <CategoryNavigation current="all" />
      <div className="search-content">
        <div className="search-filter-toolbar"><h1>Explore the archive</h1><button type="button" className="search-filter-toggle" disabled><SlidersHorizontal size={16} aria-hidden="true" /> Filters <ChevronDown size={15} aria-hidden="true" /></button></div>
        <div className="archive-results-heading"><span>Finding your next favorite…</span></div>
        <div className="masonry-grid discovery-grid search-all-grid" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <Block className="navigation-search-card" key={index} />)}</div>
      </div>
    </main>
    <SiteFooter />
  </div>
}

function DetailSkeleton() {
  return <div className="home-page item-detail-page">
    <SiteHeader />
    <main className="home-shell">
      <nav className="detail-breadcrumb" aria-label="Breadcrumb"><Link href="/search"><ArrowLeft size={14} aria-hidden="true" /> The archive</Link><ChevronRight size={12} aria-hidden="true" /><span aria-hidden="true"><Block className="navigation-breadcrumb" /></span></nav>
      <div className="detail-hero" aria-hidden="true">
        <div><Block className="artwork-stage navigation-detail-art" /><div className="artwork-caption"><Block className="navigation-short" /></div></div>
        <div className="detail-copy navigation-detail-copy"><Block className="navigation-short" /><Block className="navigation-title" /><Block className="navigation-line" /><Block className="navigation-line" /><Block className="navigation-input" /><Block className="navigation-input" /></div>
      </div>
      <div className="detail-about"><h2>Description<span>.</span></h2><span aria-hidden="true"><Block className="navigation-line" /></span></div>
    </main>
    <SiteFooter />
  </div>
}

function AccountSkeleton() {
  return <div className="navigation-account" aria-hidden="true">
    <Block className="navigation-short" /><Block className="navigation-title" /><Block className="navigation-line" />
    {Array.from({ length: 3 }, (_, index) => <div className="navigation-account-field" key={index}><Block className="navigation-short" /><Block className="navigation-input" /></div>)}
  </div>
}

function ProfileSkeleton() {
  return <div className="workspace-page profile-page" aria-hidden="true">
    <div className="profile-identity"><Block className="navigation-avatar" /><div className="navigation-profile-copy"><Block className="navigation-title" /><Block className="navigation-line" /></div></div>
    <div className="profile-content-grid"><div className="workspace-panel navigation-panel"><Block className="navigation-title" /><Block className="navigation-input" /><Block className="navigation-input" /></div><div className="workspace-panel navigation-panel"><Block className="navigation-short" /><Block className="navigation-line" /><Block className="navigation-line" /></div></div>
  </div>
}

function AdminSkeleton() {
  return <div className="workspace-page navigation-admin" aria-hidden="true"><Block className="navigation-short" /><Block className="navigation-title" /><Block className="navigation-line" /><div className="workspace-panel navigation-panel"><Block className="navigation-title" /><Block className="navigation-input" /><Block className="navigation-input" /><Block className="navigation-input" /></div></div>
}

function PolicySkeleton() {
  return <div aria-hidden="true"><div className="policy-heading navigation-panel"><Block className="navigation-title" /><Block className="navigation-line" /><Block className="navigation-short" /></div><div className="policy-reading-layout"><div className="navigation-panel">{Array.from({ length: 5 }, (_, index) => <Block className="navigation-line" key={index} />)}</div><div className="navigation-panel">{Array.from({ length: 7 }, (_, index) => <Block className={index === 0 ? 'navigation-title' : 'navigation-line'} key={index} />)}</div></div></div>
}

export function NavigationSkeleton({ variant }: { variant: SkeletonVariant }) {
  const contents = {
    home: <HomeSkeleton />,
    search: <SearchSkeleton />,
    detail: <DetailSkeleton />,
    account: <AccountSkeleton />,
    profile: <ProfileSkeleton />,
    admin: <AdminSkeleton />,
    policy: <PolicySkeleton />,
  }
  return <div className={`navigation-skeleton navigation-skeleton--${variant}`}>
    <span className="sr-only" role="status">Loading page...</span>
    {contents[variant]}
  </div>
}
