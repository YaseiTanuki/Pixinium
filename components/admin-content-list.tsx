'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteContent } from '@/app/actions/content'

type Item = { id: string; title: string; status: string; category: string; slug: string }

export function AdminContentList({ items }: { items: Item[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [deleting, setDeleting] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [removed, setRemoved] = useState<string[]>([])
  const visible = items.filter(item => !removed.includes(item.id))

  function remove(item: Item) {
    if (!window.confirm(`Delete “${item.title}” and its attached files? This cannot be undone.`)) return
    setDeleting(item.id)
    setMessage('')
    setError('')
    startTransition(async () => {
      try {
        const result = await deleteContent(item.id)
        if (result.error) setError(result.error)
        else {
          setRemoved(previous => [...previous, item.id])
          setMessage(result.message ?? 'Content deleted.')
          router.refresh()
        }
      } catch { setError('Content could not be deleted. Please try again.') }
      finally { setDeleting(null) }
    })
  }

  return <>
    {message && <p className="account-notice" role="status">{message}</p>}
    {error && <p className="account-notice" role="alert">{error}</p>}
    {visible.length ? <ul>{visible.map(item => <li key={item.id}>
      <div>{item.status === 'published' ? <Link className="account-text-link" href={`/items/${item.category}/${item.slug}`}>{item.title}</Link> : <strong>{item.title}</strong>}<span className="workspace-muted">{item.category}</span></div>
      <div className="studio-content-actions"><span className="studio-status">{item.status}</span><button type="button" className="studio-delete" disabled={pending} aria-label={`Delete ${item.title}`} onClick={() => remove(item)}>{deleting === item.id ? 'Deleting…' : 'Delete'}</button></div>
    </li>)}</ul> : <p className="workspace-muted">Saved content will appear here. New uploads are published immediately.</p>}
  </>
}
