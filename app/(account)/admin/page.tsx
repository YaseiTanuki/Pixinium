import { listDownloadProviders } from '@/server/services/download-sources.service'
import styles from '@/components/admin-studio.module.css'
import { AdminStudioIntro } from '@/components/admin-studio-intro'
import { requireAccount } from '@/server/services/auth.service'
import { AdminUploadForm } from '@/components/admin-upload-form'
import { listCategories } from '@/server/services/catalog.service'
import { neon } from '@neondatabase/serverless'
import { storageConfigured } from '@/server/services/storage.service'
import { AdminCollectionView } from '@/components/admin-collection-view'
import { ADMIN_CATALOG_PAGE_SIZE, adminCatalogParams, parseAdminCatalogFilters } from '@/lib/admin/catalog-filters'
import { adminCatalogCountQuery, adminCatalogPageQuery, adminCatalogCategoriesQuery, adminCatalogTagsQuery, adminCatalogStatusCountsQuery } from '@/server/repositories/admin-catalog.queries'
import type { Tag } from '@/lib/entities/catalog'
import '../../search/search.css'

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAccount('admin:access')
  const params = await searchParams
  const filters = parseAdminCatalogFilters(params)
  const [categories, downloadProviders] = await Promise.all([listCategories(), listDownloadProviders()])
  const ready = Boolean(process.env.CATALOG_ADMIN_DATABASE_URL && storageConfigured())
  let recent: Array<{ id: string; title: string; status: string; category: string; slug: string }> = []
  let listError = false
  let total = 0
  let page = 1
  let totalPages = 1
  let filterCategories: Array<{ id: string; slug: string; name: string }> = []
  let tags: Tag[] = []
  let statusCounts = { draft: 0, published: 0 }
  if (process.env.CATALOG_ADMIN_DATABASE_URL) {
    try {
      const sql = neon(process.env.CATALOG_ADMIN_DATABASE_URL)
      const values = adminCatalogParams(filters)
      const [[count], categoryRows, tagRows, counts] = await Promise.all([
        sql.query(adminCatalogCountQuery, values), sql.query(adminCatalogCategoriesQuery), sql.query(adminCatalogTagsQuery), sql.query(adminCatalogStatusCountsQuery),
      ])
      total = Number(count.total)
      totalPages = Math.max(1, Math.ceil(total / ADMIN_CATALOG_PAGE_SIZE))
      const requested = typeof params.page === 'string' && /^\d+$/.test(params.page) ? Number(params.page) : 1
      page = Number.isSafeInteger(requested) && requested > 0 ? Math.min(requested, totalPages) : 1
      filterCategories = categoryRows as typeof filterCategories
      tags = tagRows as Tag[]
      statusCounts = { draft: Number(counts.find(row => row.status === 'draft')?.total ?? 0), published: Number(counts.find(row => row.status === 'published')?.total ?? 0) }
      recent = await sql.query(adminCatalogPageQuery, [...values, ADMIN_CATALOG_PAGE_SIZE, (page - 1) * ADMIN_CATALOG_PAGE_SIZE, filters.sort]) as typeof recent
    } catch { listError = true }
  }
  return <div className={`workspace-page ${styles.studio}`}><AdminStudioIntro><AdminUploadForm downloadProviders={downloadProviders} categories={categories.map(({ id, name, metadataSchemaKey }) => ({ id, name, metadataSchemaKey }))} ready={ready} /></AdminStudioIntro>
    <AdminCollectionView filters={filters} statusCounts={statusCounts} recent={recent} filterCategories={filterCategories} tags={tags} total={total} page={page} totalPages={totalPages} listError={listError} /></div>
}
