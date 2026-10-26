'use client'

import Link from 'next/link'
import { MusicUploadFields } from '@/components/music-upload-fields'
import { GameUploadFields } from '@/components/game-upload-fields'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Upload } from 'lucide-react'
import type { Category, ContentUse } from '@/lib/entities/catalog'
import { fileType, fileTypes, MAX_CONTENT_FILE_BYTES, type AttachmentInput, type ContentResult } from '@/lib/admin/content'
import { createContent, prepareContentUpload, discardContentUploads } from '@/app/actions/content'

type Props = { categories: Pick<Category, 'id' | 'name' | 'metadataSchemaKey'>[]; uses: ContentUse[]; ready: boolean }

export function AdminUploadForm({ categories, uses, ready }: Props) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const pendingUploads = useRef(new Set<string>())
  const saveInProgress = useRef(false)
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [attachments, setAttachments] = useState<AttachmentInput[]>([])
  const [facts, setFacts] = useState<Array<{ key: string; label: string; value: string }>>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState<ContentResult>({})
  const category = categories.find(c => c.id === categoryId)
  const isImage = category?.metadataSchemaKey === 'images.v1'
  const isMusic = category?.metadataSchemaKey === 'music.v1'
  const isGame = category?.metadataSchemaKey === 'games.v1'
  const busy = uploading || saving || removing

  useEffect(() => {
    const cleanup = (event?: PageTransitionEvent) => {
      if (event?.persisted) return
      if (saveInProgress.current || !pendingUploads.current.size) return
      navigator.sendBeacon('/api/uploads/discard', new Blob([JSON.stringify([...pendingUploads.current])], { type: 'application/json' }))
    }
    window.addEventListener('pagehide', cleanup)
    return () => { window.removeEventListener('pagehide', cleanup); cleanup() }
  }, [])

  async function removeUploads(paths: string[]) {
    setRemoving(true)
    try {
      const response = await discardContentUploads(paths)
      if (response.error) { setResult(response); return }
      for (const path of paths) pendingUploads.current.delete(path)
      setAttachments(current => current.filter(asset => !paths.includes(asset.path)))
      setResult({})
      setProgress('Temporary uploads deleted.')
    } catch { setResult({ error: 'Could not delete temporary uploads. Please retry.' }) }
    finally { setRemoving(false) }
  }

  async function upload(files: FileList | null, kind?: 'image' | 'audio' | 'game') {
    if (!files?.length) return
    if (kind && Array.from(files).some(file => kind === 'game' ? fileType(file.name)?.extension !== 'zip' : fileType(file.name)?.mediaType !== kind)) {
      setResult({ error: kind === 'game' ? 'Choose a ZIP game package.' : kind === 'image' ? 'Choose an artwork image.' : 'Choose supported audio tracks.' }); return
    }
    if ((isMusic || isGame) && kind === 'image' && (files.length !== 1 || attachments.some(asset => fileType(asset.path)?.mediaType === 'image'))) {
      setResult({ error: 'Remove the current artwork before uploading its replacement.' }); return
    }
    if (isGame && kind === 'game' && (files.length !== 1 || attachments.some(asset => fileType(asset.path)?.extension === 'zip'))) {
      setResult({ error: 'Remove the current game package before uploading its replacement.' }); return
    }
    if (attachments.length + files.length > 12) { setResult({ error: 'Attach up to 12 files per item.' }); return }
    setUploading(true)
    setResult({})
    try {
      for (const file of Array.from(files)) {
        if (!fileType(file.name) || file.size > MAX_CONTENT_FILE_BYTES || !file.size) throw new Error('Use a supported file up to 50 MB.')
        setProgress(`Uploading ${file.name}…`)
        const prepared = await prepareContentUpload({ name: file.name, size: file.size })
        if (prepared.error || !prepared.url || !prepared.path || !prepared.mime) throw new Error(prepared.error ?? 'Could not prepare upload.')
        pendingUploads.current.add(prepared.path)
        try {
          const response = await fetch(prepared.url, { method: 'PUT', headers: { 'Content-Type': prepared.mime }, body: file })
          if (!response.ok) throw new Error('The upload failed. Check the connection and storage CORS settings, then retry.')
        } catch (error) {
          const cleanup = await discardContentUploads([prepared.path])
          if (!cleanup.error) pendingUploads.current.delete(prepared.path)
          throw error
        }
        setAttachments(current => [...current, { path: prepared.path!, role: 'download', altText: file.name, focalX: 50, focalY: 50 }])
      }
      setProgress(isGame ? kind === 'image' ? 'Artwork uploaded. Its thumbnail will be generated when you save.' : 'Game package uploaded.' : isMusic
        ? kind === 'image' ? 'Artwork uploaded. Its thumbnail will be generated when you save.' : 'Tracks uploaded. Audio properties will be detected when you save.'
        : 'Originals uploaded. A smaller thumbnail will be generated when you save.')
    } catch (error) { setResult({ error: error instanceof Error ? error.message : 'Upload failed.' }); setProgress('') }
    finally { setUploading(false) }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const metadata: Record<string, unknown> = {}
    const tags = String(form.get('tags') ?? '').split(',').map(x => x.trim()).filter(Boolean).map(name => ({ name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }))
    setSaving(true)
    saveInProgress.current = true
    setResult({})
    try {
      const response = await createContent({ categoryId, uses: form.getAll('uses'), title: form.get('title'), summary: form.get('summary'), description: form.get('description'), status: 'published', accentColor: form.get('accentColor'), isFeatured: form.has('isFeatured'), sortOrder: Number(form.get('sortOrder')), metadata, tags, facts: isImage ? [] : facts, attachments })
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
          <label>Title<input className="account-input" name="title" required maxLength={200} /></label>
          <fieldset className="studio-full"><legend className="text-sm font-bold">Suitable for</legend><p className="account-help">Choose all that apply. One upload can have several uses.</p><div className="flex flex-wrap gap-x-6 gap-y-2">{uses.map(use => <label key={use.slug} className="studio-checkbox"><input type="checkbox" name="uses" value={use.slug} />{use.name}</label>)}</div></fieldset>
          <label className="studio-full">Summary<textarea className="account-input" name="summary" rows={2} maxLength={500} /></label>
          <label className="studio-full">Description<textarea className="account-input" name="description" rows={6} maxLength={20000} /></label>
          <label className="studio-full">Tags<input className="account-input" name="tags" maxLength={1000} /><span className="account-help">Separate tags with commas, for example: cozy, night, pixel art.</span></label>
        </div>
      </section>
      {isMusic ? <MusicUploadFields attachments={attachments} ready={ready} upload={upload} remove={removeUploads}
        editLabel={(path, altText) => setAttachments(current => current.map(asset => asset.path === path ? { ...asset, altText } : asset))} /> :
      isGame ? <GameUploadFields attachments={attachments} ready={ready} upload={upload} remove={removeUploads}
        editLabel={(path, altText) => setAttachments(current => current.map(asset => asset.path === path ? { ...asset, altText } : asset))} /> :
      <section className="workspace-panel"><h2>Original files & thumbnail</h2><p className="workspace-muted">Upload the original files for download. We automatically create a smaller display thumbnail from the first image.</p>
        <label className="studio-file-picker"><Upload size={20} aria-hidden="true" /> Upload files<input className="account-input" type="file" multiple accept={Object.keys(fileTypes).map(x => `.${x}`).join(',')} disabled={!ready} onChange={e => { void upload(e.target.files); e.target.value = '' }} /><span className="account-help">Up to 12 files, 50 MB each. Use ZIP for game packages. Files stay private until the item is published.</span></label>
        {attachments.map((asset, index) => <div className="studio-attachment" key={asset.path}><div className="studio-grid">
          <p className="account-help">Original download{fileType(asset.path)?.mediaType === 'image' && attachments.find(a => fileType(a.path)?.mediaType === 'image')?.path === asset.path ? ' · Thumbnail generated automatically' : ''}</p>
          <label>Description / download label<input className="account-input" value={asset.altText} maxLength={300} onChange={e => setAttachments(current => current.map((a, i) => i === index ? { ...a, altText: e.target.value } : a))} /></label>
          {fileType(asset.path)?.mediaType === 'image' && attachments.find(a => fileType(a.path)?.mediaType === 'image')?.path === asset.path && <>{(['focalX', 'focalY'] as const).map(key => <label key={key}>{key === 'focalX' ? 'Thumbnail horizontal focus (%)' : 'Thumbnail vertical focus (%)'}<input className="account-input" type="number" min={0} max={100} value={asset[key]} onChange={e => setAttachments(current => current.map((a, i) => i === index ? { ...a, [key]: Number(e.target.value) } : a))} /></label>)}</>}
        </div><button type="button" className="account-text-link" onClick={() => void removeUploads([asset.path])}><Trash2 size={14} aria-hidden="true" /> Remove attachment</button></div>)}
      </section>}
      <div role="status" className="account-help">{progress}</div>
      {attachments.length > 0 && <button type="button" className="account-text-link" onClick={() => void removeUploads([...pendingUploads.current])}>Discard all uploads</button>}
      {isImage ? <section className="workspace-panel"><h2>Image details</h2><p className="workspace-muted">Resolution and format are detected from the original image. Creator is set to your username automatically.</p></section> : <section className="workspace-panel"><h2>Display facts</h2><p className="workspace-muted">Add details such as license, resolution or supported controls. Rows appear in this order.</p>
        {facts.map((fact, index) => <div className="studio-fact" key={index}>{(['key', 'label', 'value'] as const).map(key => <label key={key}>{key}<input className="account-input" required value={fact[key]} maxLength={key === 'key' ? 64 : key === 'label' ? 80 : 300} onChange={e => setFacts(current => current.map((f, i) => i === index ? { ...f, [key]: e.target.value } : f))} /></label>)}<button type="button" className="account-text-link" aria-label={`Remove fact ${index + 1}`} onClick={() => setFacts(current => current.filter((_, i) => i !== index))}><Trash2 size={16} aria-hidden="true" /></button></div>)}
        <button type="button" className="account-text-link" disabled={facts.length >= 20} onClick={() => setFacts(current => [...current, { key: '', label: '', value: '' }])}><Plus size={16} aria-hidden="true" /> Add fact</button>
      </section>}
      <section className="workspace-panel"><h2>Publication</h2><div className="studio-grid">
        <label>Display order<input className="account-input" type="number" name="sortOrder" defaultValue={0} min={0} max={2147483647} required /></label>
        <label>Accent color<input className="account-input" type="color" name="accentColor" defaultValue="#f1e5dd" /></label>
        <label className="studio-checkbox"><input type="checkbox" name="isFeatured" /> Feature in the archive</label>
      </div></section>
    </fieldset>
    <div aria-live="polite">{result.error && <p className="account-notice" role="alert">{result.error}</p>}{result.message && <p className="account-notice account-notice-success">{result.message} {result.href && <Link className="account-text-link" href={result.href}>View content</Link>}</p>}</div>
    <div className="studio-submit">{result.message ? <button type="button" className="account-button" onClick={() => { formRef.current?.reset(); setAttachments([]); setFacts([]); setResult({}); setProgress('') }}>Create another item</button> : <button className="account-button" disabled={busy || !ready || !categoryId}>{saving ? 'Saving content…' : uploading ? 'Uploading files…' : 'Publish content'}</button>}<p className="account-help">Publishing makes this content available to everyone.</p></div>
  </form>
}

