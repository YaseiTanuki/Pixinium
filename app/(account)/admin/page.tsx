import Link from 'next/link'
import { AdminContentList } from '@/components/admin-content-list'
import { requireAccount } from '@/server/services/auth.service'
import { AdminUploadForm } from '@/components/admin-upload-form'
import { listCategories } from '@/server/services/catalog.service'
import { neon } from '@neondatabase/serverless'
import { storageConfigured } from '@/server/services/storage.service'
import { AdminCollectionFilters } from '@/components/admin-collection-filters'
import { ADMIN_CATALOG_PAGE_SIZE, adminCatalogHref, adminCatalogParams, parseAdminCatalogFilters } from '@/lib/admin/catalog-filters'
import { adminCatalogCountQuery, adminCatalogPageQuery, adminCatalogCategoriesQuery, adminCatalogTagsQuery } from '@/server/repositories/admin-catalog.queries'
import type { Tag } from '@/lib/entities/catalog'
import '../../search/search.css'

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAccount('admin:access')
  const params = await searchParams
  const filters = parseAdminCatalogFilters(params)
  const categories = await listCategories()
  const ready = Boolean(process.env.CATALOG_ADMIN_DATABASE_URL && storageConfigured())
  let recent: Array<{ id: string; title: string; status: string; category: string; slug: string }> = []
  let listError = false
  let total = 0
  let page = 1
  let totalPages = 1
  let filterCategories: Array<{ id: string; slug: string; name: string }> = []
  let tags: Tag[] = []
  if (process.env.CATALOG_ADMIN_DATABASE_URL) {
    try {
      const sql = neon(process.env.CATALOG_ADMIN_DATABASE_URL)
      const values = adminCatalogParams(filters)
      const [[count], categoryRows, tagRows] = await Promise.all([
        sql.query(adminCatalogCountQuery, values), sql.query(adminCatalogCategoriesQuery), sql.query(adminCatalogTagsQuery),
      ])
      total = Number(count.total)
      totalPages = Math.max(1, Math.ceil(total / ADMIN_CATALOG_PAGE_SIZE))
      const requested = typeof params.page === 'string' && /^\d+$/.test(params.page) ? Number(params.page) : 1
      page = Number.isSafeInteger(requested) && requested > 0 ? Math.min(requested, totalPages) : 1
      filterCategories = categoryRows as typeof filterCategories
      tags = tagRows as Tag[]
      recent = await sql.query(adminCatalogPageQuery, [...values, ADMIN_CATALOG_PAGE_SIZE, (page - 1) * ADMIN_CATALOG_PAGE_SIZE, filters.sort]) as typeof recent
    } catch { listError = true }
  }
  return <div className="workspace-page"><header className="workspace-heading"><Link href="/profile" className="account-text-link">Back to profile</Link><h1>Admin studio</h1><p className="workspace-muted">Create wallpapers, music, games and other content for the archive.</p></header>
    <AdminUploadForm categories={categories.map(({ id, name, metadataSchemaKey }) => ({ id, name, metadataSchemaKey }))} ready={ready} />
    <section id="admin-collection" className="workspace-panel studio-recent">
      {listError ? <><h2>Content collection</h2><p className="account-notice" role="alert">Content could not be loaded. Check the catalog write connection.</p></> : <>
        <AdminCollectionFilters applied={filters} categories={filterCategories} tags={tags} total={total} />
        {recent.length ? <AdminContentList items={recent} /> : <p className="workspace-muted">{Object.entries(filters).some(([key, value]) => key !== 'tagMatch' && value) ? 'No content matches these filters. Clear or change the filters to try again.' : 'Saved content will appear here. New uploads are published immediately.'}</p>}
        {totalPages > 1 && <nav className="archive-pagination" aria-label="Admin collection pages"><p className="archive-pagination-summary">Page <strong>{page}</strong> of <strong>{totalPages}</strong></p><div className="archive-pagination-controls">{page > 1 && <Link className="archive-page-step" href={adminCatalogHref(filters, page - 1)} prefetch={false}>Previous</Link>}{page < totalPages && <Link className="archive-page-step" href={adminCatalogHref(filters, page + 1)} prefetch={false}>Next</Link>}</div></nav>}
      </>}
    </section></div>
}
