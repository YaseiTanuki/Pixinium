import Link from 'next/link'
import { ArrowLeft, ArrowRight, ArrowUpRight, FileClock, Globe } from 'lucide-react'
import { AdminCollectionFilters } from '@/components/admin-collection-filters'
import { AdminContentList } from '@/components/admin-content-list'
import { adminCatalogHref, type AdminCatalogFilters } from '@/lib/admin/catalog-filters'
import type { Tag } from '@/lib/entities/catalog'
import styles from './admin-studio.module.css'

type Props = {
  filters: AdminCatalogFilters
  statusCounts: { draft: number; published: number }
  recent: Array<{ id: string; title: string; status: string; category: string; slug: string }>
  filterCategories: Array<{ id: string; slug: string; name: string }>
  tags: Tag[]
  total: number; page: number; totalPages: number; listError: boolean
}

export function AdminCollectionView({ filters, statusCounts, recent, filterCategories, tags, total, page, totalPages, listError }: Props) {
  const pages = [...new Set([1, page - 1, page, page + 1, totalPages])].filter(value => value >= 1 && value <= totalPages).sort((a, b) => a - b)
  return (
    <section id="admin-collection" className={styles.collection}>
      <nav className={styles.statusNav} aria-label="Content publication status">
        {([{ status: 'draft', label: 'Drafts', description: 'A little review before going live.', Icon: FileClock }, { status: 'published', label: 'Published', description: 'Out in the world, ready to explore.', Icon: Globe }] as const).map(({ status, label, description, Icon }) => <Link key={status} href={adminCatalogHref({ ...filters, status })} className={styles.statusCard} data-status={status} aria-current={filters.status === status ? 'page' : undefined}><span className={styles.cardTop}><span className={styles.doorIcon}><Icon size={23} aria-hidden="true" /></span><span className={styles.count}>{statusCounts[status].toLocaleString('en')}</span></span><span className={styles.cardBottom}><span><strong>{label}</strong><small>{description}</small></span><ArrowUpRight size={18} aria-hidden="true" /></span></Link>)}
      </nav>
      <div className={styles.library}>
      {listError ? <p className={`account-notice ${styles.notice}`} role="alert">Content could not be loaded. Please try again.</p> : <>
        <div className={styles.filterArea}><AdminCollectionFilters applied={filters} categories={filterCategories} tags={tags} total={total} /></div>
        {recent.length ? <AdminContentList key={adminCatalogHref(filters, page)} items={recent} /> : <p className={styles.empty}>{filters.query || filters.category || filters.tag || filters.sort ? 'No content matches these filters. Clear or change the filters to try again.' : filters.status === 'draft' ? 'All caught up. No drafts waiting for review.' : 'No content in this view yet.'}</p>}
        {totalPages > 1 && <div className={styles.pagination}><nav className="archive-pagination" aria-label="Admin collection pages"><p className="archive-pagination-summary">Page <strong>{page}</strong> of <strong>{totalPages}</strong> · {total} items</p><div className="archive-pagination-controls">{page > 1 ? <Link className="archive-page-step" href={adminCatalogHref(filters, page - 1)} prefetch={false} aria-label="Previous page"><ArrowLeft size={16} />Previous</Link> : <span className="archive-page-step" aria-disabled="true">Previous</span>}<div className="archive-page-numbers">{pages.map((number, index) => <div key={number}>{index > 0 && number - pages[index - 1] > 1 && <span aria-hidden="true">…</span>}<Link href={adminCatalogHref(filters, number)} prefetch={false} aria-current={number === page ? 'page' : undefined} aria-label={`Page ${number}`}>{number}</Link></div>)}</div>{page < totalPages ? <Link className="archive-page-step" href={adminCatalogHref(filters, page + 1)} prefetch={false} aria-label="Next page">Next<ArrowRight size={16} /></Link> : <span className="archive-page-step" aria-disabled="true">Next</span>}</div></nav></div>}
      </>}
      </div>
    </section>
  )
}
