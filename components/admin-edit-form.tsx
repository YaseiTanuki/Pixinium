'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { CONTENT_LIMITS } from '@/lib/admin/limits'
import type { ContentUse } from '@/lib/entities/catalog'
import type { ContentResult } from '@/lib/admin/content'
import type { EditableContent } from '@/server/services/content-edit.service'
import { updateContent } from '@/app/actions/content'
import { CONTENT_SCHEMAS, contentKind } from '@/lib/content-types'
import { ContentFileFields } from '@/components/content-file-fields'
import { useContentUploads } from '@/components/use-content-uploads'

type Props = { content: EditableContent; uses: ContentUse[]; factsEditable: boolean }

export function AdminEditForm({ content, uses, factsEditable }: Props) {
  const router = useRouter()
  const [facts, setFacts] = useState(content.facts)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<ContentResult>({})
  const [replacing, setReplacing] = useState(false)
  const kind = contentKind(content.schemaKey)
  const isMusic = kind === 'music'
  const isGame = kind === 'game'
  const isAssetPack = content.schemaKey === CONTENT_SCHEMAS.asset
  const { attachments, uploading, removing, progress, pendingUploads, saveInProgress, upload, removeUploads, editLabel, reset } =
    useContentUploads({ isMusic, isGame, isAssetPack }, setResult)
  const busy = saving || uploading || removing

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (replacing && !attachments.length) { setResult({ error: 'Upload the new files or cancel the replacement.' }); return }
    const form = new FormData(event.currentTarget)
    const tags = String(form.get('tags') ?? '').split(',').map(x => x.trim()).filter(Boolean)
      .map(name => ({ name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }))
    setSaving(true)
    saveInProgress.current = true
    setResult({})
    try {
      const response = await updateContent({ id: content.id, uses: form.getAll('uses'), title: form.get('title'),
        summary: form.get('summary'), description: form.get('description'),         tags, facts: factsEditable ? facts : content.facts,
                ...(replacing ? { attachments } : {}) })
              setResult(response)
              if (response.message) { pendingUploads.current.clear(); if (replacing) { reset(); setReplacing(false) } router.refresh() }
            } catch { setResult({ error: 'Could not save changes. Your entries are preserved; please retry.' }) }
            finally { saveInProgress.current = false; setSaving(false) }
          }

          async function cancelReplace() {
            await removeUploads([...pendingUploads.current])
            if (pendingUploads.current.size) return
            reset()
            setResult({})
            setReplacing(false)
          }

          return <form onSubmit={submit} className="studio-form" aria-busy={busy}>
            <fieldset disabled={busy} className="studio-fields">
      <section className="workspace-panel"><h2>Content details</h2>
        <div className="studio-grid">
          <label>Title<input className="account-input" name="title" required defaultValue={content.title} maxLength={CONTENT_LIMITS.title} /></label>
          <fieldset className="studio-full"><legend className="text-sm font-bold">Suitable for</legend><div className="flex flex-wrap gap-x-6 gap-y-2">{uses.map(use => <label key={use.slug} className="studio-checkbox"><input type="checkbox" name="uses" value={use.slug} defaultChecked={content.uses.includes(use.slug)} />{use.name}</label>)}</div></fieldset>
          <label className="studio-full">Summary<textarea className="account-input" name="summary" rows={2} defaultValue={content.summary} maxLength={CONTENT_LIMITS.summary} /></label>
          <label className="studio-full">Description<textarea className="account-input" name="description" rows={6} defaultValue={content.description} maxLength={CONTENT_LIMITS.description} /></label>
          <label className="studio-full">Tags<input className="account-input" name="tags" defaultValue={content.tags.join(', ')} maxLength={1000} /><span className="account-help">Separate tags with commas, for example: cozy, night, pixel art.</span></label>
        </div>
      </section>
      {factsEditable && <section className="workspace-panel"><h2>Display facts</h2><p className="workspace-muted">Rows appear in this order.</p>
        {facts.map((fact, index) => <div className="studio-fact" key={index}>{(['key', 'label', 'value'] as const).map(key => <label key={key}>{key}<input className="account-input" required value={fact[key]} maxLength={key === 'key' ? CONTENT_LIMITS.factKey : key === 'label' ? CONTENT_LIMITS.factLabel : CONTENT_LIMITS.factValue} onChange={e => setFacts(current => current.map((f, i) => i === index ? { ...f, [key]: e.target.value } : f))} /></label>)}<button type="button" className="account-text-link" aria-label={`Remove fact ${index + 1}`} onClick={() => setFacts(current => current.filter((_, i) => i !== index))}><Trash2 size={16} aria-hidden="true" /></button></div>)}
        <button type="button" className="account-text-link" disabled={facts.length >= CONTENT_LIMITS.facts} onClick={() => setFacts(current => [...current, { key: '', label: '', value: '' }])}><Plus size={16} aria-hidden="true" /> Add fact</button>
      </section>}
      <section className="workspace-panel"><h2>Files</h2>
        <ul className="workspace-muted">{content.files.map((file, index) => <li key={index}>{file.label} · {file.role}</li>)}</ul>
        {replacing ? <>
          <p className="account-notice" role="alert">The current files will be permanently deleted when you save.</p>
          <ContentFileFields kind={{ isMusic, isGame, isAssetPack }} attachments={attachments} ready={!busy} upload={upload} remove={removeUploads} editLabel={editLabel} />
          <div role="status" className="account-help">{progress}</div>
          <button type="button" className="account-text-link" onClick={() => void cancelReplace()}>Cancel replacement</button>
        </> : <button type="button" className="account-text-link" onClick={() => setReplacing(true)}>Replace files</button>}
      </section>
    </fieldset>
    <div aria-live="polite">{result.error && <p className="account-notice" role="alert">{result.error}</p>}{result.message && <p className="account-notice account-notice-success">{result.message} {result.href && <Link className="account-text-link" href={result.href}>View content</Link>}</p>}</div>
    <div className="studio-submit"><button className="account-button" disabled={busy}>{saving ? 'Saving changes…' : 'Save changes'}</button></div>
  </form>
}
