'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { saveDownloadProvider, deleteDownloadProvider } from '@/app/actions/download-sources'
import type { ManagedDownloadProvider } from '@/lib/download-sources'
import styles from './download-source-manager.module.css'

function SourceForm({ source }: { source?: ManagedDownloadProvider }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ error?: string; message?: string }>({})
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const element = event.currentTarget
    const form = new FormData(element)
    setBusy(true); setResult({})
    try {
      const response = await saveDownloadProvider(source ? 'update' : 'create', {
        slug: source?.slug ?? form.get('slug'), name: form.get('name'),
        hostname: source?.kind === 'internal' ? null : form.get('hostname'),
        priority: Number(form.get('priority')), isActive: form.has('active'),
      })
      setResult(response)
      if (response.message) { if (!source) element.reset(); router.refresh() }
    } catch { setResult({ error: 'Could not save. Your entries are preserved; please retry.' }) }
    finally { setBusy(false) }
  }
  async function remove() {
    if (!source) return
    setBusy(true); setResult({})
    try {
      const response = await deleteDownloadProvider(source.slug)
      setResult(response)
      if (response.message) router.refresh()
    } catch { setResult({ error: 'Could not delete. Please retry.' }) }
    finally { setBusy(false) }
  }
  return <form onSubmit={submit} className={styles.form} aria-busy={busy}>
    {source && <div className={styles.identity}><strong>{source.name}</strong><span>{source.slug} · {source.itemCount} items{source.kind === 'internal' && ' · Hosted files'}</span></div>}
    <fieldset disabled={busy} className={styles.fields}>
      {!source && <label>Source ID<input className="account-input" name="slug" required pattern="[a-z][a-z0-9_]{0,59}" maxLength={60} placeholder="example_source" /><span className="account-help">Stable ID; cannot be renamed.</span></label>}
      <label>Name<input className="account-input" name="name" required maxLength={80} defaultValue={source?.name} /></label>
      {source?.kind !== 'internal' && <label>Domain<input className="account-input" name="hostname" required maxLength={253} placeholder="example.org" defaultValue={source?.hostname ?? ''} readOnly={Boolean(source?.itemCount)} /><span className="account-help">{source?.itemCount ? 'Remove item links before changing the domain.' : 'Exact domain, without https:// or a path.'}</span></label>}
      <label>Priority<input className="account-input" name="priority" type="number" required min={0} max={9999} step={1} defaultValue={source?.priority ?? 4} /><span className="account-help">Lower numbers appear first.</span></label>
      <label className={styles.active}><input type="checkbox" name="active" defaultChecked={source?.isActive ?? true} />Enabled</label>
      <div className={styles.buttons}><button className="account-button" disabled={busy}>{busy ? 'Saving…' : source ? 'Save changes' : 'Add source'}</button>
        {source?.kind === 'external' && <button type="button" className="account-text-link" disabled={busy || source.itemCount > 0} onClick={() => void remove()}>Delete unused source</button>}
      </div>
    </fieldset>
    <div aria-live="polite">{result.error && <p className="account-notice" role="alert">{result.error}</p>}{result.message && <p className="account-notice account-notice-success">{result.message}</p>}</div>
  </form>
}

export function DownloadSourceManager({ sources }: { sources: ManagedDownloadProvider[] }) {
  return <>
    <section className="workspace-panel"><h2>Configured sources</h2><p className="workspace-muted">Sources are listed in download order. Disable a source to hide it while keeping its item links. A source in use cannot be deleted.</p>
      {sources.map(source => <SourceForm key={source.slug} source={source} />)}
    </section>
    <section className={`workspace-panel ${styles.add}`}><h2>Add download source</h2><p className="workspace-muted">Create a source here, then add its URL when creating or editing an item.</p><SourceForm /></section>
  </>
}
