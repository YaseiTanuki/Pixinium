'use client'

import { useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { addStoryChapter } from '@/app/actions/content'
import { MAX_STORY_CHAPTER_BYTES } from '@/lib/story-chapters'

export function StoryChapterUpload({ itemId, chapterNumbers }: { itemId: string; chapterNumbers: number[] }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [chapterNumber, setChapterNumber] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const file = fileRef.current?.files?.[0]
    const number = Number(chapterNumber)
    setError('')
    setMessage('')
    if (!file || !/\.md$/i.test(file.name)) {
      setError('Choose a Markdown file with the .md extension.')
      return
    }
    if (file.size < 1 || file.size > MAX_STORY_CHAPTER_BYTES) {
      setError('Choose a non-empty Markdown file up to 512 KB.')
      return
    }
    if (!Number.isSafeInteger(number) || number < 1 || chapterNumbers.includes(number)) {
      setError('Enter a positive chapter number that has not been used.')
      return
    }

    setBusy(true)
    try {
      const contentMarkdown = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer())
      const result = await addStoryChapter({ itemId, chapterNumber: number, contentMarkdown })
      if (result.error) {
        setError(result.error)
        return
      }
      setMessage(result.message ?? 'Chapter added.')
      setChapterNumber('')
      if (fileRef.current) fileRef.current.value = ''
      router.refresh()
    } catch (cause) {
      setError(cause instanceof TypeError ? 'The Markdown file must be valid UTF-8.' : 'Chapter could not be uploaded. Please retry.')
    } finally {
      setBusy(false)
    }
  }

  return <form className="story-chapter-upload" onSubmit={submit} aria-busy={busy}>
    {chapterNumbers.length > 0 && <p className="workspace-muted">Chapters: {chapterNumbers.join(', ')}</p>}
    <div className="story-chapter-upload-fields">
      <label>Chapter number<input className="account-input" type="number" min={1} max={100000} step={1} required value={chapterNumber} onChange={event => setChapterNumber(event.target.value)} /></label>
      <label>Markdown file<input ref={fileRef} className="account-input" type="file" accept=".md,text/markdown,text/plain" required /></label>
      <button className="account-button" disabled={busy}>{busy ? 'Adding chapter…' : 'Add chapter'}</button>
    </div>
    {message && <p className="account-help" role="status">{message}</p>}
    {error && <p className="account-notice" role="alert">{error}</p>}
  </form>
}
