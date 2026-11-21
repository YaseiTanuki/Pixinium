'use client'

import Link from '@/components/navigation-link'
import { useState, useTransition } from 'react'
import { useNavigationRouter as useRouter } from '@/components/navigation-transition'
import { deleteContent } from '@/app/actions/content'
import { AdminPublicationAction } from '@/components/admin-publication-action'
import { AdminDraftReview } from '@/components/admin-draft-review'
import { Pencil, Trash2 } from 'lucide-react'
import { categoryIcon } from '@/lib/category-icons'
import styles from './admin-studio.module.css'

type Item = { id: string; title: string; status: string; category: string; slug: string }

export function AdminContentList({ items, reviewDrafts = false }: { items: Item[]; reviewDrafts?: boolean }) {
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
    {message && <p className={`account-notice ${styles.notice}`} role="status">{message}</p>}
    {error && <p className={`account-notice ${styles.notice}`} role="alert">{error}</p>}
    {reviewDrafts && <p className={styles.reviewHint}>Review saved drafts here, then publish each one when ready. Files load as you scroll.</p>}
    {visible.length ? <>{!reviewDrafts && <div className={styles.listHead} aria-hidden="true"><span>CONTENT</span><span>STATUS</span><span>ACTIONS</span></div>}<ul className={reviewDrafts ? styles.reviewGrid : styles.list}>{visible.map(item => {
      const key = ({ images: 'image', music: 'music', games: 'gamepad', assets: 'grid' } as Record<string, string>)[item.category] ?? 'grid'
      const Icon = categoryIcon(key)
      if (reviewDrafts) return <li key={item.id} className={styles.reviewCard}>
        <header className={styles.reviewHeader}><div><h2>{item.title}</h2><div className={styles.meta}><span>{item.category}</span><span>#{item.id}</span></div></div><span className={styles.badge} data-status={item.status}>{item.status}</span></header>
        <AdminDraftReview id={item.id}>{ready => <div className={styles.reviewActions}><Link className={styles.edit} href={`/admin/${item.id}/edit`} prefetch={false}><Pencil size={13} aria-hidden="true" />Edit</Link><AdminPublicationAction id={item.id} status={item.status} disabled={!ready} /><button type="button" className={styles.delete} disabled={pending} aria-label={`Delete ${item.title}`} onClick={() => remove(item)}><Trash2 size={15} aria-hidden="true" /></button></div>}</AdminDraftReview>
      </li>
      return <li key={item.id} className={styles.row}>
        <div className={styles.identity}><span className={styles.itemIcon} data-kind={item.category}><Icon size={20} strokeWidth={1.5} aria-hidden="true" /></span><div className={styles.itemCopy}><Link className={styles.title} href={item.status === 'published' ? `/items/${item.category}/${item.slug}` : `/admin/${item.id}/edit`}>{item.title}</Link><div className={styles.meta}><span>{item.category}</span><span>#{item.id}</span></div></div></div>
        <span className={styles.badge} data-status={item.status}>{item.status}</span>
        <div className={styles.actions}><Link className={styles.edit} href={`/admin/${item.id}/edit`} aria-label={`${item.status === 'draft' ? 'Review' : 'Edit'} ${item.title}`}><Pencil size={13} aria-hidden="true" />{item.status === 'draft' ? 'Review' : 'Edit'}</Link><AdminPublicationAction id={item.id} status={item.status} /><button type="button" className={styles.delete} disabled={pending} title={deleting === item.id ? 'Deleting…' : 'Delete content'} aria-label={`Delete ${item.title}`} onClick={() => remove(item)}><Trash2 size={15} aria-hidden="true" /></button></div>
      </li>
    })}</ul></> : <p className={styles.empty}>No content matches this view.</p>}
  </>
}
