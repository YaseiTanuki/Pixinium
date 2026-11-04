'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setContentStatus } from '@/app/actions/content'
import { Check, FileClock } from 'lucide-react'
import styles from './admin-studio.module.css'

export function AdminPublicationAction({ id, status, label }: { id: string; status: string; label?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  if (!['draft', 'published'].includes(status)) return null
  return <div className={styles.publication}>
    <button type="button" className={styles.statusAction} data-status={status} disabled={pending} onClick={() => {
      setError('')
      startTransition(async () => {
        try {
          const result = await setContentStatus({ id, status: status === 'draft' ? 'published' : 'draft' })
          if (result.error) setError(result.error)
          else router.refresh()
        } catch { setError('Could not change publication status. Please retry.') }
      })
    }}>{status === 'draft' ? <Check size={13} aria-hidden="true" /> : <FileClock size={13} aria-hidden="true" />}{pending ? 'Updating…' : label ?? (status === 'draft' ? 'Publish' : 'Move to drafts')}</button>
    {error && <p role="alert" className={styles.actionError}>{error}</p>}
  </div>
}
