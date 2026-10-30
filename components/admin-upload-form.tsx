'use client'

import Link from 'next/link'
import { ASSET_PACK_LIMITS, CONTENT_LIMITS } from '@/lib/admin/limits'
import { CONTENT_SCHEMAS, contentKind } from '@/lib/content-types'
import { AssetUploadFields } from '@/components/asset-upload-fields'
import { MusicUploadFields } from '@/components/music-upload-fields'
import { GameUploadFields } from '@/components/game-upload-fields'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Upload } from 'lucide-react'
import type { Category, ContentUse } from '@/lib/entities/catalog'
import { fileType, acceptedFileTypes, MAX_CONTENT_FILE_BYTES, type AttachmentInput, type ContentResult } from '@/lib/admin/content'
import { createContent, prepareContentUpload, discardContentUploads } from '@/app/actions/content'
import { MAX_STORY_CHAPTER_BYTES } from '@/lib/story-chapters'

type Props = { categories: Pick<Category, 'id' | 'name' | 'metadataSchemaKey'>[]; uses: ContentUse[]; ready: boolean }

export function AdminUploadForm({ categories, uses, ready }: Props) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const initialChapterFileRef = useRef<HTMLInputElement>(null)
  const pendingUploads = useRef(new Set<string>())
  const saveInProgress = useRef(false)
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [attachments, setAttachments] = useState<AttachmentInput[]>([])
  const [facts, setFacts] = useState<Array<{ key: string; label: string; value: string }>>([])
  const [chapterNumber, setChapterNumber] = useState('')
  const [chapterFile, setChapterFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState<ContentResult>({})
  const category = categories.find(c => c.id === categoryId)
  const kind = contentKind(category?.metadataSchemaKey)
  const isImage = kind === 'image'
  const isMusic = kind === 'music'
  const isGame = kind === 'game'
  const isStory = kind === 'story'
  const isAssetPack = category?.metadataSchemaKey === CONTENT_SCHEMAS.asset
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

  async function upload(files: FileList | null, kind?: 'image' | 'audio' | 'game' | 'cover' | 'pack-image') {
    if (!files?.length) return
    const mediaKind = kind === 'cover' || kind === 'pack-image' ? 'image' : kind
    if (isStory && (files.length !== 1 || attachments.length > 0 || Array.from(files).some(file => fileType(file.name)?.mediaType !== 'image'))) {
      setResult({ error: 'Choose one book cover image. Remove the current cover before replacing it.' }); return
    }
    if (mediaKind && Array.from(files).some(file => mediaKind === 'game' ? fileType(file.name)?.extension !== 'zip' : fileType(file.name)?.mediaType !== mediaKind)) {
      setResult({ error: kind === 'game' ? 'Choose a ZIP game package.' : mediaKind === 'image' ? 'Choose a supported image.' : 'Choose supported audio tracks.' }); return
    }
    if (kind === 'cover' && (files.length !== 1 || attachments.some(asset => asset.role === 'cover'))) {
      setResult({ error: 'Remove the current thumbnail before uploading its replacement.' }); return
    }
    if (kind === 'pack-image' && attachments.filter(asset => asset.role === 'download').length + files.length > ASSET_PACK_LIMITS.images) {
      setResult({ error: `Upload up to ${ASSET_PACK_LIMITS.images} pack images.` }); return
    }
    if ((isMusic || isGame) && kind === 'image' && (files.length !== 1 || attachments.some(asset => fileType(asset.path)?.mediaType === 'image'))) {
      setResult({ error: 'Remove the current artwork before uploading its replacement.' }); return
    }
    if (isGame && kind === 'game' && (files.length !== 1 || attachments.some(asset => fileType(asset.path)?.extension === 'zip'))) {
      setResult({ error: 'Remove the current game package before uploading its replacement.' }); return
    }
    const fileLimit = isStory ? 1 : isAssetPack ? ASSET_PACK_LIMITS.images + 1 : CONTENT_LIMITS.files
    if (attachments.length + files.length > fileLimit) { setResult({ error: `Attach up to ${fileLimit} files per item.` }); return }
    setUploading(true)
    setResult({})
    try {
      for (const file of Array.from(files)) {
        if (!fileType(file.name) || file.size > MAX_CONTENT_FILE_BYTES || !file.size) throw new Error(`Use a supported file up to ${CONTENT_LIMITS.fileMegabytes} MB.`)
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
        setAttachments(current => [...current, { path: prepared.path!, role: kind === 'cover' ? 'cover' : 'download',
          fileName: file.name, altText: file.name, focalX: 50, focalY: 50 }])
      }
      setProgress(isAssetPack ? 'Images uploaded. The ZIP and previews will be generated when you publish.' : isStory ? 'Book cover uploaded. Its display thumbnail will be generated when you publish.' : isGame ? kind === 'image' ? 'Artwork uploaded. Its thumbnail will be generated when you save.' : 'Game package uploaded.' : isMusic
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
      let initialChapter: { chapterNumber: number; contentMarkdown: string } | undefined
      if (isStory) {
        if (chapterFile && (!Number.isSafeInteger(Number(chapterNumber)) || Number(chapterNumber) < 1 || Number(chapterNumber) > 100_000)) {
          setResult({ error: 'Enter a chapter number between 1 and 100,000.' })
          return
        }
        if (!chapterFile && chapterNumber.trim()) {
          setResult({ error: 'Choose a Markdown file for the chapter number you entered.' })
          return
        }
        if (chapterFile) {
          if (!/\.md$/i.test(chapterFile.name) || chapterFile.size < 1 || chapterFile.size > MAX_STORY_CHAPTER_BYTES) {
            setResult({ error: 'Choose a non-empty .md file up to 512 KB.' })
            return
          }
          initialChapter = {
            chapterNumber: Number(chapterNumber),
            contentMarkdown: new TextDecoder('utf-8', { fatal: true }).decode(await chapterFile.arrayBuffer()),
          }
        }
      }
      const response = await createContent({ categoryId, uses: form.getAll('uses'), title: form.get('title'), summary: form.get('summary'), description: form.get('description'), status: 'published', metadata, tags, facts: isImage ? [] : facts, attachments, initialChapter })
      setResult(response)
      if (response.message) { pendingUploads.current.clear(); router.refresh() }
    } catch (error) {
      setResult({ error: error instanceof TypeError
        ? 'The Markdown file must be valid UTF-8.'
        : 'Could not save content. Your entries are preserved; please retry.' })
    }
    finally { saveInProgress.current = false; setSaving(false) }
  }

  return <form ref={formRef} onSubmit={submit} className="studio-form" aria-busy={busy}>
    {!ready && <p className="account-notice">The studio needs its catalog write connection and upload storage configured before content can be saved.</p>}
    <fieldset disabled={busy || Boolean(result.message)} className="studio-fields">
      <section className="workspace-panel"><h2>Content details</h2><p className="workspace-muted">Choose a category and describe what you’re adding.</p>
        <div className="studio-grid">
          <label>Category<select className="account-input" value={categoryId} onChange={e => { setCategoryId(e.target.value); setProgress(''); setResult({}); setChapterNumber(''); setChapterFile(null); if (initialChapterFileRef.current) initialChapterFileRef.current.value = '' }} required><option value="" disabled>Select a category</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Title<input className="account-input" name="title" required maxLength={CONTENT_LIMITS.title} /></label>
          <fieldset className="studio-full"><legend className="text-sm font-bold">Suitable for</legend><p className="account-help">Choose all that apply. One upload can have several uses.</p><div className="flex flex-wrap gap-x-6 gap-y-2">{uses.map(use => <label key={use.slug} className="studio-checkbox"><input type="checkbox" name="uses" value={use.slug} />{use.name}</label>)}</div></fieldset>
          <label className="studio-full">Summary<textarea className="account-input" name="summary" rows={2} maxLength={CONTENT_LIMITS.summary} /></label>
          <label className="studio-full">Description<textarea className="account-input" name="description" rows={6} maxLength={CONTENT_LIMITS.description} /><span className="account-help">{isStory ? 'A synopsis or introduction for the story. Chapter text is uploaded separately as Markdown.' : 'Add more detail about this item.'}</span></label>
          {isStory && <fieldset className="studio-full story-initial-chapter"><legend>First chapter (optional)</legend><p className="account-help">Add a Markdown chapter now, or publish the book and add chapters later from the chapter upload section below.</p><div className="story-chapter-upload-fields">
            <label>Chapter number<input className="account-input" type="number" min={1} max={100000} step={1} value={chapterNumber} onChange={e => setChapterNumber(e.target.value)} /></label>
            <label>Markdown file (.md)<input ref={initialChapterFileRef} className="account-input" type="file" accept=".md,text/markdown,text/plain" onChange={e => setChapterFile(e.currentTarget.files?.[0] ?? null)} /></label>
          </div>{chapterFile && <p className="account-help" role="status">Selected: {chapterFile.name}</p>}</fieldset>}
          <label className="studio-full">Tags<input className="account-input" name="tags" maxLength={1000} /><span className="account-help">Separate tags with commas, for example: cozy, night, pixel art.</span></label>
        </div>
      </section>
      {isAssetPack ? <AssetUploadFields attachments={attachments} ready={ready} upload={upload} remove={removeUploads}
        editLabel={(path, altText) => setAttachments(current => current.map(asset => asset.path === path ? { ...asset, altText } : asset))} /> :
      isMusic ? <MusicUploadFields attachments={attachments} ready={ready} upload={upload} remove={removeUploads}
        editLabel={(path, altText) => setAttachments(current => current.map(asset => asset.path === path ? { ...asset, altText } : asset))} /> :
      isGame ? <GameUploadFields attachments={attachments} ready={ready} upload={upload} remove={removeUploads}
        editLabel={(path, altText) => setAttachments(current => current.map(asset => asset.path === path ? { ...asset, altText } : asset))} /> :
      <section className="workspace-panel"><h2>{isStory ? 'Book cover' : 'Original files & thumbnail'}</h2><p className="workspace-muted">{isStory ? 'Upload one image for the front cover. We’ll use it to create the book card and a smaller thumbnail.' : 'Upload the original files for download. We automatically create a smaller display thumbnail from the first image.'}</p>
        <label className="studio-file-picker"><Upload size={20} aria-hidden="true" /> {isStory ? 'Upload book cover' : 'Upload files'}<input className="account-input" type="file" multiple={!isStory} accept={isStory ? acceptedFileTypes('image') : acceptedFileTypes()} disabled={!ready} onChange={e => { void upload(e.target.files); e.target.value = '' }} /><span className="account-help">{isStory ? `One image, up to ${CONTENT_LIMITS.fileMegabytes} MB. The cover is used only as book artwork.` : `Up to ${CONTENT_LIMITS.files} files, ${CONTENT_LIMITS.fileMegabytes} MB each. Use ZIP for game packages. Files stay private until the item is published.`}</span></label>
        {attachments.map((asset, index) => <div className="studio-attachment" key={asset.path}><div className="studio-grid">
          <p className="account-help">{isStory ? 'Book cover · Thumbnail generated automatically' : `Original download${fileType(asset.path)?.mediaType === 'image' && attachments.find(a => fileType(a.path)?.mediaType === 'image')?.path === asset.path ? ' · Thumbnail generated automatically' : ''}`}</p>
          <label>{isStory ? 'Cover image description' : 'Description / download label'}<input className="account-input" value={asset.altText} maxLength={CONTENT_LIMITS.attachmentLabel} onChange={e => setAttachments(current => current.map((a, i) => i === index ? { ...a, altText: e.target.value } : a))} /></label>
          {fileType(asset.path)?.mediaType === 'image' && attachments.find(a => fileType(a.path)?.mediaType === 'image')?.path === asset.path && <>{(['focalX', 'focalY'] as const).map(key => <label key={key}>{key === 'focalX' ? 'Thumbnail horizontal focus (%)' : 'Thumbnail vertical focus (%)'}<input className="account-input" type="number" min={0} max={100} value={asset[key]} onChange={e => setAttachments(current => current.map((a, i) => i === index ? { ...a, [key]: Number(e.target.value) } : a))} /></label>)}</>}
        </div><button type="button" className="account-text-link" onClick={() => void removeUploads([asset.path])}><Trash2 size={14} aria-hidden="true" /> Remove attachment</button></div>)}
      </section>}
      <div role="status" className="account-help">{progress}</div>
      {attachments.length > 0 && <button type="button" className="account-text-link" onClick={() => void removeUploads([...pendingUploads.current])}>Discard all uploads</button>}
      {isAssetPack ? <section className="workspace-panel"><h2>Asset details</h2><p className="workspace-muted">Quantity is counted from the pack images. Download format is ZIP. Creator is set to Pixinium automatically for admin uploads.</p></section> : isImage ? null : <section className="workspace-panel"><h2>{isStory ? 'Story details' : 'Display facts'}</h2><p className="workspace-muted">{isStory ? 'Add optional details such as author, series or reading order.' : 'Add details such as license, resolution or supported controls. Rows appear in this order.'}</p>
        {facts.map((fact, index) => <div className="studio-fact" key={index}>{(['key', 'label', 'value'] as const).map(key => <label key={key}>{key}<input className="account-input" required value={fact[key]} maxLength={key === 'key' ? CONTENT_LIMITS.factKey : key === 'label' ? CONTENT_LIMITS.factLabel : CONTENT_LIMITS.factValue} onChange={e => setFacts(current => current.map((f, i) => i === index ? { ...f, [key]: e.target.value } : f))} /></label>)}<button type="button" className="account-text-link" aria-label={`Remove fact ${index + 1}`} onClick={() => setFacts(current => current.filter((_, i) => i !== index))}><Trash2 size={16} aria-hidden="true" /></button></div>)}
        <button type="button" className="account-text-link" disabled={facts.length >= CONTENT_LIMITS.facts} onClick={() => setFacts(current => [...current, { key: '', label: '', value: '' }])}><Plus size={16} aria-hidden="true" /> Add fact</button>
      </section>}
    </fieldset>
    <div aria-live="polite">{result.error && <p className="account-notice" role="alert">{result.error}</p>}{result.message && <p className="account-notice account-notice-success">{result.message} {result.href && <Link className="account-text-link" href={result.href}>View content</Link>}</p>}</div>
    <div className="studio-submit">{result.message ? <button type="button" className="account-button" onClick={() => { formRef.current?.reset(); setAttachments([]); setFacts([]); setChapterNumber(''); setChapterFile(null); setResult({}); setProgress('') }}>Create another item</button> : <button className="account-button" disabled={busy || !ready || !categoryId}>{saving ? 'Saving content…' : uploading ? 'Uploading files…' : 'Publish content'}</button>}<p className="account-help">Publishing makes this content available to everyone.</p></div>
  </form>
}
