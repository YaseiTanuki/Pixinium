import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { CategoryNavigation } from '@/components/category-navigation'
import '../search/search.css'
import '../categories/category.css'
import './loading.css'

export default function CategoryLoading() {
  return <div className="home-page category-page">
    <SiteHeader />
    <span className="sr-only" role="status">Loading collection...</span>
    <div className="page-shell catalog-layout category-loading">
      <CategoryNavigation />
      <main className="category-loading-main">
        <div className="category-banner category-loading-banner">
          <div className="category-loading-banner-copy"><p className="eyebrow">THE PIXINIUM COLLECTION</p>
            <span className="category-loading-block category-loading-title" aria-hidden="true" />
            <span className="category-loading-block category-loading-description" aria-hidden="true" /></div>
          <span className="category-loading-block category-loading-mark" aria-hidden="true" />
        </div>
        <div className="catalog-filters" data-scope="category" aria-hidden="true">
          <div className="search-filter-toolbar">
            <div className="category-toolbar category-loading-toolbar">
              <div><span className="category-loading-block category-loading-heading" /><span className="category-loading-block category-loading-count" /></div>
              <span className="category-loading-block category-loading-search" />
            </div>
            <span className="category-loading-block category-loading-filter" />
          </div>
        </div>
        <div className="category-loading-results" aria-hidden="true">
          {Array.from({ length: 3 }, (_, index) => <span className="category-loading-block category-loading-row" key={index} />)}
        </div>
      </main>
    </div>
    <SiteFooter />
  </div>
}
