'use client'

import Link from 'next/link'
import { useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Upload } from 'lucide-react'
import type { Category, ContentUse } from '@/lib/entities/catalog'
import { fileType, fileTypes, MAX_CONTENT_FILE_BYTES, type AttachmentInput, type ContentResult } from '@/lib/admin/content'
import { createContent, prepareContentUpload } from '@/app/actions/content'
import { createClient } from '@/lib/supabase/client'

type Props = { categories: Pick<Category, 'id' | 'name' | 'metadataSchemaKey'>[]; uses: ContentUse[]; ready: boolean }
const details: Record<string, Array<{ key: string; label: string; type?: 'number'; hint?: string }>> = {
  'images.v1': [{ key: 'width', label: 'Width (px)', type: 'number' }, { key: 'height', label: 'Height (px)', type: 'number' }, { key: 'image_count', label: 'Image count', type: 'number' }, { key: 'formats', label: 'Formats', hint: 'png, jpg, webp, avif' }],
  'music.v1': [{ key: 'track_count', label: 'Track count', type: 'number' }, { key: 'duration_seconds', label: 'Duration (seconds)', type: 'number' }, { key: 'formats', label: 'Formats', hint: 'mp3, flac, wav, ogg, aac' }],
  'games.v1': [{ key: 'size_bytes', label: 'Package size (bytes)', type: 'number' }, { key: 'version', label: 'Version' }, { key: 'platforms', label: 'Platforms', hint: 'windows, macos, linux, web, android, ios' }],
}

export function AdminUploadForm({ categories, uses, ready }: Props) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [attachments, setAttachments] = useState<AttachmentInput[]>([])
  const [facts, setFacts] = useState<Array<{ key: string; label: string; value: string }>>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState<ContentResult>({})
  const category = categories.find(c => c.id === categoryId)
  const fields = details[category?.metadataSchemaKey ?? ''] ?? []
  const busy = uploading || saving

  async function upload(files: FileList | null) {
    if (!files?.length) return
    if (attachments.length + files.length > 12) { setResult({ error: 'Attach up to 12 files per item.' }); return }
    setUploading(true)
    setResult({})
    try {
      const client = createClient()
      for (const file of Array.from(files)) {
        if (!fileType(file.name) || file.size > MAX_CONTENT_FILE_BYTES || !file.size) throw new Error('Use a supported file up to 50 MB.')
        setProgress(`Uploading ${file.name}…`)
        const prepared = await prepareContentUpload({ name: file.name, size: file.size })
        if (prepared.error || !prepared.token || !prepared.path || !prepared.bucket) throw new Error(prepared.error ?? 'Could not prepare upload.')
        const { error } = await client.storage.from(prepared.bucket).uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: prepared.mime })
        if (error) throw new Error('The upload failed. Check the connection and storage file limits, then retry.')
        setAttachments(current => [...current, { path: prepared.path!, role: fileType(file.name)?.mediaType === 'image' && !current.some(a => a.role === 'cover') ? 'cover' : 'download', altText: file.name, focalX: 50, focalY: 50 }])
      }
      setProgress('Files uploaded. Choose their purpose, then save the content.')
    } catch (error) { setResult({ error: error instanceof Error ? error.message : 'Upload failed.' }); setProgress('') }
    finally { setUploading(false) }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const metadata: Record<string, unknown> = {}
    for (const field of fields) {
      const value = String(form.get(`metadata.${field.key}`) ?? '').trim()
      if (value) metadata[field.key] = field.type === 'number' ? Number(value) : ['platforms', 'formats'].includes(field.key) ? value.split(',').map(x => x.trim().toLowerCase()).filter(Boolean) : value
    }
    const tags = String(form.get('tags') ?? '').split(',').map(x => x.trim()).filter(Boolean).map(name => ({ name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }))
    setSaving(true)
    setResult({})
    try {
      const response = await createContent({ categoryId, uses: form.getAll('uses'), title: form.get('title'), slug: form.get('slug'), summary: form.get('summary'), description: form.get('description'), status: form.get('status'), accentColor: form.get('accentColor'), isFeatured: form.has('isFeatured'), sortOrder: Number(form.get('sortOrder')), metadata, tags, facts, attachments })
      setResult(response)
      if (response.message) router.refresh()
    } catch { setResult({ error: 'Could not save content. Your entries are preserved; please retry.' }) }
    finally { setSaving(false) }
  }

  return <form ref={formRef} onSubmit={submit} className="studio-form" aria-busy={busy}>
    {!ready && <p className="account-notice">The studio needs its catalog write connection and upload storage configured before content can be saved.</p>}
    <fieldset disabled={busy || Boolean(result.message)} className="studio-fields">
      <section className="workspace-panel"><h2>Content details</h2><p className="workspace-muted">Choose a category and describe what you’re adding.</p>
        <div className="studio-grid">
          <label>Category<select className="account-input" value={categoryId} onChange={e => setCategoryId(e.target.value)} required><option value="" disabled>Select a category</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Title<input className="account-input" name="title" required maxLength={200} /></label>
          <fieldset className="studio-full"><legend className="text-sm font-bold">Suitable for</legend><p className="account-help">Choose all that apply. One upload can have several uses.</p><div className="flex flex-wrap gap-x-6 gap-y-2">{uses.map(use => <label key={use.slug} className="studio-checkbox"><input type="checkbox" name="uses" value={use.slug} />{use.name}</label>)}</div></fieldset>
          <label className="studio-full">URL slug<input className="account-input" name="slug" required maxLength={120} pattern="[a-z0-9]+(-[a-z0-9]+)*" spellCheck={false} /><span className="account-help">Lowercase letters, numbers and hyphens. Unique within this category.</span></label>
          <label className="studio-full">Summary<textarea className="account-input" name="summary" rows={2} maxLength={500} /></label>
          <label className="studio-full">Description<textarea className="account-input" name="description" rows={6} maxLength={20000} /></label>
          <label className="studio-full">Tags<input className="account-input" name="tags" maxLength={1000} /><span className="account-help">Separate tags with commas, for example: cozy, night, pixel art.</span></label>
        </div>
      </section>
      {fields.length > 0 && <section className="workspace-panel" key={categoryId}><h2>{category?.name} properties</h2><p className="workspace-muted">Optional technical details stored with this content.</p><div className="studio-grid">{fields.map(field => <label key={field.key}>{field.label}<input className="account-input" name={`metadata.${field.key}`} type={field.type ?? 'text'} min={0} step={1} maxLength={200} />{field.hint && <span className="account-help">{field.hint}</span>}</label>)}</div></section>}
      <section className="workspace-panel"><h2>Files & artwork</h2><p className="workspace-muted">Attach a cover, gallery images, audio/video previews or downloadable packages.</p>
        <label className="studio-file-picker"><Upload size={20} aria-hidden="true" /> Upload files<input className="account-input" type="file" multiple accept={Object.keys(fileTypes).map(x => `.${x}`).join(',')} disabled={!ready} onChange={e => { void upload(e.target.files); e.target.value = '' }} /><span className="account-help">Up to 12 files, 50 MB each. Use ZIP for game packages. Files stay private until the item is published.</span></label>
        <div role="status" className="account-help">{progress}</div>
        {attachments.map((asset, index) => <div className="studio-attachment" key={asset.path}><div className="studio-grid">
          <label>Purpose<select className="account-input" value={asset.role} onChange={e => setAttachments(current => current.map((a, i) => i === index ? { ...a, role: e.target.value as AttachmentInput['role'] } : a))}><option value="cover">Cover image</option><option value="gallery">Gallery image</option><option value="preview">Preview</option><option value="download">Download</option></select></label>
          <label>Description / download label<input className="account-input" value={asset.altText} maxLength={300} onChange={e => setAttachments(current => current.map((a, i) => i === index ? { ...a, altText: e.target.value } : a))} /></label>
          {asset.role === 'cover' && <>{(['focalX', 'focalY'] as const).map(key => <label key={key}>{key === 'focalX' ? 'Horizontal focus (%)' : 'Vertical focus (%)'}<input className="account-input" type="number" min={0} max={100} value={asset[key]} onChange={e => setAttachments(current => current.map((a, i) => i === index ? { ...a, [key]: Number(e.target.value) } : a))} /></label>)}</>}
        </div><button type="button" className="account-text-link" onClick={() => setAttachments(current => current.filter((_, i) => i !== index))}><Trash2 size={14} aria-hidden="true" /> Remove attachment</button></div>)}
      </section>
      <section className="workspace-panel"><h2>Display facts</h2><p className="workspace-muted">Add details such as license, resolution or supported controls. Rows appear in this order.</p>
        {facts.map((fact, index) => <div className="studio-fact" key={index}>{(['key', 'label', 'value'] as const).map(key => <label key={key}>{key}<input className="account-input" required value={fact[key]} maxLength={key === 'key' ? 64 : key === 'label' ? 80 : 300} onChange={e => setFacts(current => current.map((f, i) => i === index ? { ...f, [key]: e.target.value } : f))} /></label>)}<button type="button" className="account-text-link" aria-label={`Remove fact ${index + 1}`} onClick={() => setFacts(current => current.filter((_, i) => i !== index))}><Trash2 size={16} aria-hidden="true" /></button></div>)}
        <button type="button" className="account-text-link" disabled={facts.length >= 20} onClick={() => setFacts(current => [...current, { key: '', label: '', value: '' }])}><Plus size={16} aria-hidden="true" /> Add fact</button>
      </section>
      <section className="workspace-panel"><h2>Publication</h2><div className="studio-grid">
        <label>Status<select className="account-input" name="status" defaultValue="draft"><option value="draft">Draft — private</option><option value="published">Published — visible in the archive</option></select></label>
        <label>Display order<input className="account-input" type="number" name="sortOrder" defaultValue={0} min={0} max={2147483647} required /></label>
        <label>Accent color<input className="account-input" type="color" name="accentColor" defaultValue="#f1e5dd" /></label>
        <label className="studio-checkbox"><input type="checkbox" name="isFeatured" /> Feature in the archive</label>
      </div></section>
    </fieldset>
    <div aria-live="polite">{result.error && <p className="account-notice" role="alert">{result.error}</p>}{result.message && <p className="account-notice account-notice-success">{result.message} {result.href && <Link className="account-text-link" href={result.href}>View content</Link>}</p>}</div>
    <div className="studio-submit">{result.message ? <button type="button" className="account-button" onClick={() => { formRef.current?.reset(); setAttachments([]); setFacts([]); setResult({}); setProgress('') }}>Create another item</button> : <button className="account-button" disabled={busy || !ready || !categoryId}>{saving ? 'Saving content…' : uploading ? 'Uploading files…' : 'Save content'}</button>}<p className="account-help">Drafts remain private. Published content is available to everyone.</p></div>
  </form>
}

