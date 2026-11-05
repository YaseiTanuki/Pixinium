import Link from 'next/link'
import { requireAccount } from '@/server/services/auth.service'
import { listManagedDownloadProviders } from '@/server/services/download-sources.service'
import { DownloadSourceManager } from '@/components/download-source-manager'

export default async function DownloadSourcesPage() {
  await requireAccount('admin:access')
  const sources = await listManagedDownloadProviders()
  return <div className="workspace-page">
    <header className="workspace-heading"><Link className="account-text-link" href="/admin">Back to admin studio</Link><h1>Download sources</h1><p className="workspace-muted">Manage source names, domains and priority. Changes apply to every item that uses a source.</p></header>
    <DownloadSourceManager sources={sources} />
  </div>
}
