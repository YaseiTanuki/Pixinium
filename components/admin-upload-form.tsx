'use client'

import Link from 'next/link'
import { ASSET_PACK_LIMITS, CONTENT_LIMITS } from '@/lib/admin/limits'
import { CONTENT_SCHEMAS, contentKind } from '@/lib/content-types'
import { ContentFileFields } from '@/components/content-file-fields'
import { useContentUploads } from '@/components/use-content-uploads'
import { useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import type { Category, ContentUse } from '@/lib/entities/catalog'
import type { ContentResult } from '@/lib/admin/content'
import { createContent } from '@/app/actions/content'

type Props = { categories: Pick<Category, 'id' | 'name' | 'metadataSchemaKey'>[]; uses: ContentUse[]; ready: boolean }

export function AdminUploadForm({ categories, uses, ready }: Props) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [facts, setFacts] = useState<Array<{ key: string; label: string; value: string }>>([])
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<ContentResult>({})
  const category = categories.find(c => c.id === categoryId)
  const kind = contentKind(category?.metadataSchemaKey)
  const isImage = kind === 'image'
  const isMusic = kind === 'music'
  const isGame = kind === 'game'
  const isAssetPack = category?.metadataSchemaKey === CONTENT_SCHEMAS.asset
  const { attachments, setAttachments, uploading, removing, progress, setProgress, pendingUploads, saveInProgress, upload, removeUploads, editLabel, reset } =
    useContentUploads({ isMusic, isGame, isAssetPack }, setResult)
  const busy = uploading || saving || removing

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const metadata: Record<string, unknown> = {}
    const tags = String(form.get('tags') ?? '').split(',').map(x => x.trim()).filter(Boolean).map(name => ({ name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }))
    setSaving(true)
    saveInProgress.current = true
    setResult({})
    try {
      const response = await createContent({ categoryId, uses: form.getAll('uses'), title: form.get('title'), summary: form.get('summary'), description: form.get('description'), status: 'published', metadata, tags, facts: isImage ? [] : facts, attachments })
      setResult(response)
      if (response.message) { pendingUploads.current.clear(); router.refresh() }
    } catch { setResult({ error: 'Could not save content. Your entries are preserved; please retry.' }) }
    finally { saveInProgress.current = false; setSaving(false) }
  }

  return <form ref={formRef} onSubmit={submit} className="studio-form" aria-busy={busy}>
    {!ready && <p className="account-notice">The studio needs its catalog write connection and upload storage configured before content can be saved.</p>}
    <fieldset disabled={busy || Boolean(result.message)} className="studio-fields">
      <section className="workspace-panel"><h2>Content details</h2><p className="workspace-muted">Choose a category and describe what you’re adding.</p>
        <div className="studio-grid">
          <label>Category<select className="account-input" value={categoryId} onChange={e => { setCategoryId(e.target.value); setProgress(''); setResult({}) }} required><option value="" disabled>Select a category</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Title<input className="account-input" name="title" required maxLength={CONTENT_LIMITS.title} /></label>
          <fieldset className="studio-full"><legend className="text-sm font-bold">Suitable for</legend><p className="account-help">Choose all that apply. One upload can have several uses.</p><div className="flex flex-wrap gap-x-6 gap-y-2">{uses.map(use => <label key={use.slug} className="studio-checkbox"><input type="checkbox" name="uses" value={use.slug} />{use.name}</label>)}</div></fieldset>
          <label className="studio-full">Summary<textarea className="account-input" name="summary" rows={2} maxLength={CONTENT_LIMITS.summary} /></label>
          <label className="studio-full">Description<textarea className="account-input" name="description" rows={6} maxLength={CONTENT_LIMITS.description} /></label>
          <label className="studio-full">Tags<input className="account-input" name="tags" maxLength={1000} /><span className="account-help">Separate tags with commas, for example: cozy, night, pixel art.</span></label>
        </div>
      </section>
      <ContentFileFields kind={{ isMusic, isGame, isAssetPack }} attachments={attachments} ready={ready} upload={upload} remove={removeUploads} editLabel={editLabel} />
      <div role="status" className="account-help">{progress}</div>
      {attachments.length > 0 && <button type="button" className="account-text-link" onClick={() => void removeUploads([...pendingUploads.current])}>Discard all uploads</button>}
      {isAssetPack ? <section className="workspace-panel"><h2>Asset details</h2><p className="workspace-muted">Quantity is counted from the pack images. Download format is ZIP. Creator is set to Pixinium automatically for admin uploads.</p></section> : isImage ? null : <section className="workspace-panel"><h2>Display facts</h2><p className="workspace-muted">Add details such as license, resolution or supported controls. Rows appear in this order.</p>
        {facts.map((fact, index) => <div className="studio-fact" key={index}>{(['key', 'label', 'value'] as const).map(key => <label key={key}>{key}<input className="account-input" required value={fact[key]} maxLength={key === 'key' ? CONTENT_LIMITS.factKey : key === 'label' ? CONTENT_LIMITS.factLabel : CONTENT_LIMITS.factValue} onChange={e => setFacts(current => current.map((f, i) => i === index ? { ...f, [key]: e.target.value } : f))} /></label>)}<button type="button" className="account-text-link" aria-label={`Remove fact ${index + 1}`} onClick={() => setFacts(current => current.filter((_, i) => i !== index))}><Trash2 size={16} aria-hidden="true" /></button></div>)}
        <button type="button" className="account-text-link" disabled={facts.length >= CONTENT_LIMITS.facts} onClick={() => setFacts(current => [...current, { key: '', label: '', value: '' }])}><Plus size={16} aria-hidden="true" /> Add fact</button>
      </section>}
    </fieldset>
    <div aria-live="polite">{result.error && <p className="account-notice" role="alert">{result.error}</p>}{result.message && <p className="account-notice account-notice-success">{result.message} {result.href && <Link className="account-text-link" href={result.href}>View content</Link>}</p>}</div>
    <div className="studio-submit">{result.message ? <button type="button" className="account-button" onClick={() => { formRef.current?.reset(); reset(); setFacts([]); setResult({}) }}>Create another item</button> : <button className="account-button" disabled={busy || !ready || !categoryId}>{saving ? 'Saving content…' : uploading ? 'Uploading files…' : 'Publish content'}</button>}<p className="account-help">Publishing makes this content available to everyone.</p></div>
  </form>
}

