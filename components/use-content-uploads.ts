'use client'

import { useEffect, useRef, useState } from 'react'
import { ASSET_PACK_LIMITS, CONTENT_LIMITS } from '@/lib/admin/limits'
import { fileType, MAX_CONTENT_FILE_BYTES, type AttachmentInput, type ContentResult } from '@/lib/admin/content'
import { prepareContentUpload, discardContentUploads } from '@/app/actions/content'

export type UploadKind = 'image' | 'audio' | 'game' | 'cover' | 'pack-image'
type Flags = { isMusic: boolean; isGame: boolean; isAssetPack: boolean }

/** Staging uploads shared by the create and edit forms; leftovers are discarded when the page is left. */
export function useContentUploads({ isMusic, isGame, isAssetPack }: Flags, setResult: (result: ContentResult) => void) {
  const pendingUploads = useRef(new Set<string>())
  const saveInProgress = useRef(false)
  const [attachments, setAttachments] = useState<AttachmentInput[]>([])
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [progress, setProgress] = useState('')

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
    if (!paths.length) { setAttachments([]); setProgress(''); return }
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

  async function upload(files: FileList | null, kind?: UploadKind) {
    if (!files?.length) return
    const mediaKind = kind === 'cover' || kind === 'pack-image' ? 'image' : kind
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
    const fileLimit = isAssetPack ? ASSET_PACK_LIMITS.images + 1 : CONTENT_LIMITS.files
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
      setProgress(isAssetPack ? 'Images uploaded. The ZIP and previews will be generated when you publish.' : isGame ? kind === 'image' ? 'Artwork uploaded. Its thumbnail will be generated when you save.' : 'Game package uploaded.' : isMusic
        ? kind === 'image' ? 'Artwork uploaded. Its thumbnail will be generated when you save.' : 'Tracks uploaded. Audio properties will be detected when you save.'
        : 'Originals uploaded. A smaller thumbnail will be generated when you save.')
    } catch (error) { setResult({ error: error instanceof Error ? error.message : 'Upload failed.' }); setProgress('') }
    finally { setUploading(false) }
  }

  const editLabel = (path: string, altText: string) => setAttachments(current => current.map(asset => asset.path === path ? { ...asset, altText } : asset))
  const reset = () => { setAttachments([]); setProgress('') }
  return { attachments, setAttachments, uploading, removing, progress, setProgress, pendingUploads, saveInProgress, upload, removeUploads, editLabel, reset }
}
