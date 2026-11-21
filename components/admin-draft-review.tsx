'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { EditableContent } from '@/server/services/content-edit.service'
import styles from './admin-studio.module.css'

export function AdminDraftReview({ id, children }: { id: string; children: (ready: boolean) => ReactNode }) {
  const container = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [content, setContent] = useState<EditableContent | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!container.current) return
    if (!('IntersectionObserver' in window)) { setActive(true); return }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setActive(true); observer.disconnect() }
    }, { rootMargin: '160px' })
    observer.observe(container.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    setError('')
    void fetch(`/api/admin/content/${id}`, { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Could not load draft. Please retry.')
      const value: EditableContent = await response.json()
      if (!controller.signal.aborted) setContent(value)
    }).catch(() => {
      if (!controller.signal.aborted) setError('Could not load draft. Please retry.')
    })
    return () => controller.abort()
  }, [active, id, attempt])

  return <div ref={container} className={styles.reviewBody}>
    {content ? <>
      {content.summary && <section><h3>Summary</h3><p className={styles.reviewText}>{content.summary}</p></section>}
      <section><h3>Description</h3><p className={styles.reviewText}>{content.description || 'No description.'}</p></section>
      <section><h3>Tags</h3><div className={styles.reviewTags}>{content.tags.length ? content.tags.map(tag => <span key={tag}>{tag}</span>) : <p>No tags.</p>}</div></section>
      {!!content.facts.length && <section><h3>Details</h3><dl className={styles.reviewFacts}>{content.facts.map(fact => <div key={fact.key}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl></section>}
      {!!content.downloadSources?.length && <section><h3>Download sources</h3>{content.downloadSources.map(source => <a className={styles.reviewLink} key={source.provider} href={source.url} target="_blank" rel="noopener noreferrer">{source.provider}: {source.url}</a>)}</section>}
      <section><h3>Files · {content.files.length}</h3><div className={styles.reviewFiles}>{content.files.map(file => <figure key={file.assetId}>
        {file.mediaType === 'image' ? <a href={`/api/admin/assets/${file.assetId}`} target="_blank" rel="noopener noreferrer" aria-label={`Open ${file.label || file.role}`}><img src={`/api/admin/assets/${file.assetId}`} alt={file.label} loading="lazy" decoding="async" /></a>
          : file.mediaType === 'audio' ? <audio controls preload="none" src={`/api/admin/assets/${file.assetId}`} aria-label={file.label || 'Audio preview'} />
            : file.mediaType === 'video' ? <video controls preload="none" src={`/api/admin/assets/${file.assetId}`} aria-label={file.label || 'Video preview'} /> : null}
        <figcaption><a className={styles.reviewLink} href={`/api/admin/assets/${file.assetId}?download=1`}>{file.label || 'Download file'}</a><span>{file.role} · {file.mimeType || file.mediaType}</span></figcaption>
      </figure>)}</div></section>
    </> : error ? <div role="alert"><p>{error}</p><button type="button" className={styles.edit} onClick={() => { setError(''); setAttempt(value => value + 1) }}>Retry</button></div>
      : <p className={styles.reviewLoading} role="status">{active ? 'Loading draft…' : 'Draft loads as you scroll.'}</p>}
    {children(Boolean(content))}
  </div>
}
