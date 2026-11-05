import { listManagedDownloadProviders } from '@/server/services/download-sources.service'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AdminEditForm } from '@/components/admin-edit-form'
import { requireAccount } from '@/server/services/auth.service'
import { getEditableContentForActor } from '@/server/services/content-edit.service'
import { usesAutomaticFacts } from '@/lib/content-types'
import { AdminPublicationAction } from '@/components/admin-publication-action'

export default async function AdminEditPage({ params }: { params: Promise<{ id: string }> }) {
  const account = await requireAccount('admin:access')
  const { id } = await params
  const content = await getEditableContentForActor(account, id)
  if (!content) notFound()
  const factsEditable = !usesAutomaticFacts(content.schemaKey)
  return <div className="workspace-page"><header className="workspace-heading"><Link href="/admin" className="account-text-link">Back to admin studio</Link><h1>Edit content</h1>
    <p className="workspace-muted">{content.status === 'draft' ? 'Private draft. Review its files and save any changes before publishing.' : 'Manage content details, attached files and publication.'}</p><span className="studio-status" data-status={content.status}>{content.status}</span></header>
    <section className="workspace-panel studio-review"><h2>Review files</h2><div className="studio-review-files">{content.files.map(file => <div className="studio-review-file" key={file.assetId}>
      {file.mediaType === 'image' ? <img src={`/api/admin/assets/${file.assetId}`} alt={file.label} loading="lazy" /> : file.mediaType === 'audio' ? <audio controls preload="none" src={`/api/admin/assets/${file.assetId}`} aria-label={file.label} /> : null}
      <a className="account-text-link" href={`/api/admin/assets/${file.assetId}?download=1`}>{file.label || 'Download file'} · {file.role}</a>
    </div>)}</div></section>
    <AdminEditForm content={content} factsEditable={factsEditable} downloadProviders={await listManagedDownloadProviders()} />
    <section className="workspace-panel studio-review-publish"><h2>Publication</h2><p className="workspace-muted">{content.status === 'draft' ? 'Only the saved version will be published. Unsaved edits are not included.' : 'Move this item to drafts to remove it from the public archive.'}</p><AdminPublicationAction id={content.id} status={content.status} label={content.status === 'draft' ? 'Publish saved draft' : undefined} /></section></div>
}
