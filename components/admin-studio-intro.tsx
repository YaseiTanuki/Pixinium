import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowLeft, ChevronDown, Plus } from 'lucide-react'
import styles from './admin-studio.module.css'

export function AdminStudioIntro({ children }: { children: ReactNode }) {
  return <div className={styles.intro}>
    <header className={styles.heading}>
      <Link href="/profile" className={styles.back}><ArrowLeft size={14} aria-hidden="true" />Back to profile</Link>
      <h1>Admin studio</h1>
      <p>Review submissions and manage your little archive.</p>
    </header>
    <details className={styles.create}>
      <summary className={styles.createButton}><Plus size={16} aria-hidden="true" />Add new content<ChevronDown size={14} aria-hidden="true" /></summary>
      {children}
    </details>
  </div>
}
