import Link from 'next/link'
import { AdminContentList } from '@/components/admin-content-list'
import { requireAccount } from '@/server/services/auth.service'
import { AdminUploadForm } from '@/components/admin-upload-form'
import { listCategories, listContentUses } from '@/server/services/catalog.service'
import { neon } from '@neondatabase/serverless'
import { storageConfigured } from '@/server/services/storage.service'

export default async function AdminPage() {
  await requireAccount('admin:access')
  const [categories, uses] = await Promise.all([listCategories(), listContentUses()])
  const ready = Boolean(process.env.CATALOG_ADMIN_DATABASE_URL && storageConfigured())
  let recent: Array<{ id: string; title: string; status: string; category: string; slug: string }> = []
  let listError = false
  if (process.env.CATALOG_ADMIN_DATABASE_URL) {
    try {
      recent = await neon(process.env.CATALOG_ADMIN_DATABASE_URL).query(`SELECT i.id::text, i.title, i.status, i.slug, c.slug AS category
        FROM catalog.items i JOIN catalog.categories c ON c.id = i.category_id ORDER BY i.created_at DESC, i.id DESC LIMIT 20`) as typeof recent
    } catch { listError = true }
  }
  return <div className="workspace-page"><header className="workspace-heading"><Link href="/profile" className="account-text-link">Back to profile</Link><h1>Admin studio</h1><p className="workspace-muted">Create wallpapers, music, games and other content for the archive.</p></header>
    <AdminUploadForm categories={categories.map(({ id, name, metadataSchemaKey }) => ({ id, name, metadataSchemaKey }))} uses={uses} ready={ready} />
    <section className="workspace-panel studio-recent"><h2>Recent content</h2>{listError ? <p className="account-notice">Recent content could not be loaded. Check the catalog write connection.</p> : <AdminContentList items={recent} />}</section></div>
}
