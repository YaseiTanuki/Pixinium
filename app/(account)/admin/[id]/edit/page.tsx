import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AdminEditForm } from '@/components/admin-edit-form'
import { requireAccount } from '@/server/services/auth.service'
import { getEditableContentForActor } from '@/server/services/content-edit.service'
import { usesAutomaticFacts } from '@/lib/content-types'

export default async function AdminEditPage({ params }: { params: Promise<{ id: string }> }) {
  const account = await requireAccount('admin:access')
  const { id } = await params
  const content = await getEditableContentForActor(account, id)
  if (!content) notFound()
  const factsEditable = !usesAutomaticFacts(content.schemaKey)
  return <div className="workspace-page"><header className="workspace-heading"><Link href="/admin" className="account-text-link">Back to admin studio</Link><h1>Edit content</h1>
    <p className="workspace-muted">Update the text details. Files and the page address stay the same.</p></header>
    <AdminEditForm content={content} factsEditable={factsEditable} /></div>
}
