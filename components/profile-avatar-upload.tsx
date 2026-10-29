'use client'

import { Camera, LoaderCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { discardAvatarUpload, prepareAvatarUpload, saveAvatar } from '@/app/actions/profile-avatar'

const validTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxBytes = 2 * 1024 * 1024

export function ProfileAvatarUpload() {
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const [status, setStatus] = useState('')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (status !== 'Avatar updated.') return
    const timer = window.setTimeout(() => setStatus(''), 3_000)
    return () => window.clearTimeout(timer)
  }, [status])

  async function upload(file: File | undefined) {
    if (!file) return
    if (!validTypes.has(file.type) || !file.size || file.size > maxBytes) {
      setStatus('Choose a JPG, PNG or WebP image up to 2 MB.')
      return
    }
    setUploading(true)
    setStatus('Uploading avatar…')
    let path: string | undefined
    let uploadCompleted = false
    try {
      const prepared = await prepareAvatarUpload({ type: file.type, size: file.size })
      if (prepared.error || !prepared.url || !prepared.path || !prepared.mime) throw new Error(prepared.error ?? 'Could not prepare upload.')
      path = prepared.path
      const response = await fetch(prepared.url, { method: 'PUT', headers: { 'Content-Type': prepared.mime }, body: file })
      if (!response.ok) throw new Error('The upload failed. Please try again.')
      uploadCompleted = true
      const saved = await saveAvatar({ path })
      if (saved.error) throw new Error(saved.error)
      setStatus('Avatar updated.')
      router.refresh()
    } catch (error) {
      if (path && !uploadCompleted) await discardAvatarUpload({ path })
      setStatus(error instanceof Error ? error.message : 'Could not upload your avatar. Please try again.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return <div className="profile-avatar-upload" aria-busy={uploading}>
    <input ref={inputRef} id="profile-avatar" name="avatar" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading}
      onChange={event => void upload(event.currentTarget.files?.[0])} />
    <label htmlFor="profile-avatar" className="profile-avatar-button" aria-label={uploading ? 'Uploading avatar' : 'Change avatar'} title={uploading ? 'Uploading avatar' : 'Change avatar'} aria-disabled={uploading}>
      {uploading ? <LoaderCircle className="animate-spin" size={20} aria-hidden="true" /> : <Camera size={20} aria-hidden="true" />}
      <span>{uploading ? 'Uploading…' : 'Upload photo'}</span>
    </label>
    {status && <p className="profile-avatar-status" role="status" aria-live="polite">{status}</p>}
  </div>
}
