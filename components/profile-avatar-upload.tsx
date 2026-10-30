'use client'

import { Camera, ImagePlus, LoaderCircle, Minus, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useRouter } from 'next/navigation'
import { discardAvatarUpload, prepareAvatarUpload, saveAvatar } from '@/app/actions/profile-avatar'

const validTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxBytes = 2 * 1024 * 1024
const previewSize = 224
const outputSize = 512

type CropDraft = { file: File; url: string; image: HTMLImageElement }
type CropOffset = { x: number; y: number }

function getImageSize(image: HTMLImageElement, zoom: number, frameSize: number) {
  const scale = Math.max(frameSize / image.naturalWidth, frameSize / image.naturalHeight) * zoom
  return { width: image.naturalWidth * scale, height: image.naturalHeight * scale }
}

function clampOffset(value: number, imageSize: number, frameSize: number) {
  const limit = Math.max(0, (imageSize - frameSize) / 2)
  return Math.min(limit, Math.max(-limit, value))
}

async function createCroppedAvatar(draft: CropDraft, zoom: number, offset: CropOffset, frameSize: number) {
  const { width, height } = getImageSize(draft.image, zoom, frameSize)
  const sourceSize = frameSize / width * draft.image.naturalWidth
  const sourceX = ((width - frameSize) / 2 - offset.x) / width * draft.image.naturalWidth
  const sourceY = ((height - frameSize) / 2 - offset.y) / height * draft.image.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = outputSize
  canvas.height = outputSize
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Your browser could not prepare the cropped image. Please try another browser.')
  context.drawImage(draft.image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, outputSize, outputSize)
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(result => result ? resolve(result) : reject(new Error('Your browser could not prepare the cropped image. Please try again.')), draft.file.type, 0.9)
  })
  if (blob.size > maxBytes) throw new Error('The cropped image is too large. Choose a smaller image and try again.')
  const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'
  return new File([blob], `avatar.${extension}`, { type: blob.type })
}

export function ProfileAvatarUpload() {
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cropUrlRef = useRef<string | null>(null)
  const dragRef = useRef<{ pointerId: number; x: number; y: number; offset: CropOffset } | null>(null)
  const router = useRouter()
  const [status, setStatus] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dropActive, setDropActive] = useState(false)
  const [cropDraft, setCropDraft] = useState<CropDraft | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState<CropOffset>({ x: 0, y: 0 })
  const [frameSize, setFrameSize] = useState(previewSize)
  const dragDepthRef = useRef(0)

  useEffect(() => {
    const updateFrameSize = () => setFrameSize(Math.max(160, Math.min(previewSize, window.innerWidth - 66)))
    updateFrameSize()
    window.addEventListener('resize', updateFrameSize)
    return () => window.removeEventListener('resize', updateFrameSize)
  }, [])

  useEffect(() => () => {
    if (cropUrlRef.current) URL.revokeObjectURL(cropUrlRef.current)
  }, [])

  useEffect(() => {
    if (status !== 'Avatar updated.') return
    const timer = window.setTimeout(() => setStatus(''), 3_000)
    return () => window.clearTimeout(timer)
  }, [status])

  function releaseCropDraft() {
    setDialogOpen(false)
    setDropActive(false)
    dragDepthRef.current = 0
    if (cropUrlRef.current) URL.revokeObjectURL(cropUrlRef.current)
    cropUrlRef.current = null
    setCropDraft(null)
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    if (inputRef.current) inputRef.current.value = ''
  }

  function openDialog() {
    setStatus('')
    setCropDraft(null)
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    setDialogOpen(true)
    dialogRef.current?.showModal()
  }

  function selectImage(file: File | undefined) {
    if (!file) return
    if (!validTypes.has(file.type) || !file.size || file.size > maxBytes) {
      setStatus('Choose a JPG, PNG or WebP image up to 2 MB.')
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    if (cropUrlRef.current) URL.revokeObjectURL(cropUrlRef.current)
    const url = URL.createObjectURL(file)
    cropUrlRef.current = url
    const image = new Image()
    image.onload = () => {
      if (cropUrlRef.current !== url) return
      setCropDraft({ file, url, image })
      setZoom(1)
      setOffset({ x: 0, y: 0 })
      setStatus('')
      if (!dialogRef.current?.open) {
        setDialogOpen(true)
        dialogRef.current?.showModal()
      }
    }
    image.onerror = () => {
      if (cropUrlRef.current === url) {
        URL.revokeObjectURL(url)
        cropUrlRef.current = null
        setStatus('This image could not be opened. Choose another image and try again.')
      }
      if (inputRef.current) inputRef.current.value = ''
    }
    image.src = url
  }

  async function upload(file: File) {
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
      return true
    } catch (error) {
      if (path && !uploadCompleted) await discardAvatarUpload({ path })
      setStatus(error instanceof Error ? error.message : 'Could not upload your avatar. Please try again.')
      return false
    } finally {
      setUploading(false)
    }
  }

  function changeZoom(nextZoom: number) {
    if (!cropDraft) return
    const imageSize = getImageSize(cropDraft.image, nextZoom, frameSize)
    setZoom(nextZoom)
    setOffset(current => ({
      x: clampOffset(current.x, imageSize.width, frameSize),
      y: clampOffset(current.y, imageSize.height, frameSize),
    }))
  }

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (!cropDraft) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, offset }
  }

  function dragCrop(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId || !cropDraft) return
    const imageSize = getImageSize(cropDraft.image, zoom, frameSize)
    setOffset({
      x: clampOffset(drag.offset.x + event.clientX - drag.x, imageSize.width, frameSize),
      y: clampOffset(drag.offset.y + event.clientY - drag.y, imageSize.height, frameSize),
    })
  }

  async function confirmCrop() {
    if (!cropDraft) return
    try {
      const croppedFile = await createCroppedAvatar(cropDraft, zoom, offset, frameSize)
      if (await upload(croppedFile)) dialogRef.current?.close()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not crop your avatar. Please try again.')
    }
  }

  const cropImageSize = cropDraft ? getImageSize(cropDraft.image, zoom, frameSize) : null

  return <div className="profile-avatar-upload" aria-busy={uploading}>
    <button type="button" className="profile-avatar-button" aria-label={uploading ? 'Uploading avatar' : 'Change avatar'} title={uploading ? 'Uploading avatar' : 'Change avatar'} disabled={uploading}
      onClick={openDialog}>
      {uploading ? <LoaderCircle className="animate-spin" size={20} aria-hidden="true" /> : <Camera size={20} aria-hidden="true" />}
      <span>{uploading ? 'Uploading…' : 'Upload photo'}</span>
    </button>
    {status && <p className="profile-avatar-status" role="status" aria-live="polite" aria-hidden={dialogOpen}>{status}</p>}
    <dialog ref={dialogRef} className="profile-avatar-dialog" aria-labelledby="profile-avatar-dialog-title" aria-describedby="profile-avatar-dialog-description"
      onClose={releaseCropDraft} onCancel={event => { if (uploading) event.preventDefault() }} onClick={event => { if (event.target === event.currentTarget && !uploading) dialogRef.current?.close() }}>
      <input ref={inputRef} id="profile-avatar" name="avatar" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading}
        onChange={event => selectImage(event.currentTarget.files?.[0])} />
      <div className="profile-avatar-dialog-heading">
        <div><p className="profile-avatar-dialog-kicker">PROFILE PHOTO</p><h2 id="profile-avatar-dialog-title">Your profile photo</h2></div>
        <button type="button" className="profile-avatar-dialog-close" aria-label="Close photo editor" disabled={uploading} onClick={() => dialogRef.current?.close()}><X size={18} aria-hidden="true" /></button>
      </div>
      <p id="profile-avatar-dialog-description" className="profile-avatar-dialog-description">
        {cropDraft ? 'Drag to position · use the slider to zoom' : 'Choose a photo or drop it here'}
      </p>
      {cropDraft && cropImageSize ? <>
        <div className="profile-avatar-crop-stage" style={{ width: frameSize, height: frameSize }}
          onPointerDown={startDrag} onPointerMove={dragCrop} onPointerUp={() => { dragRef.current = null }} onPointerCancel={() => { dragRef.current = null }}>
          <img src={cropDraft.url} width={Math.ceil(cropImageSize.width)} height={Math.ceil(cropImageSize.height)} alt="Avatar crop preview" draggable={false}
            style={{ width: cropImageSize.width, height: cropImageSize.height, transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)` }} />
          <span className="profile-avatar-crop-outline" aria-hidden="true" />
        </div>
        <div className="profile-avatar-editor-controls">
          <div className="profile-avatar-zoom-control">
            <label htmlFor="profile-avatar-zoom">Zoom</label>
            <button type="button" aria-label="Zoom out" disabled={uploading || zoom <= 1} onClick={() => changeZoom(Math.max(1, zoom - 0.1))}><Minus size={16} aria-hidden="true" /></button>
            <input id="profile-avatar-zoom" type="range" min="1" max="3" step="0.05" value={zoom} disabled={uploading}
              onChange={event => changeZoom(Number(event.currentTarget.value))} aria-valuetext={`${Math.round(zoom * 100)} percent`} />
            <button type="button" aria-label="Zoom in" disabled={uploading || zoom >= 3} onClick={() => changeZoom(Math.min(3, zoom + 0.1))}><Plus size={16} aria-hidden="true" /></button>
            <output htmlFor="profile-avatar-zoom">{Math.round(zoom * 100)}%</output>
          </div>
        </div>
      </> : <label htmlFor="profile-avatar" style={{ width: frameSize, height: frameSize }} className={`profile-avatar-dropzone${dropActive ? ' is-active' : ''}${uploading ? ' is-disabled' : ''}`}
        onDragEnter={event => { event.preventDefault(); dragDepthRef.current += 1; setDropActive(true) }}
        onDragOver={event => event.preventDefault()}
        onDragLeave={event => { event.preventDefault(); dragDepthRef.current = Math.max(0, dragDepthRef.current - 1); if (!dragDepthRef.current) setDropActive(false) }}
        onDrop={event => { event.preventDefault(); dragDepthRef.current = 0; setDropActive(false); selectImage(event.dataTransfer.files[0]) }}>
        <span className="profile-avatar-dropzone-icon"><ImagePlus size={24} aria-hidden="true" /></span>
        <span className="profile-avatar-dropzone-title">Drop a photo here</span>
        <span className="profile-avatar-dropzone-copy">or click to browse your files</span>
        <span className="profile-avatar-dropzone-meta">JPG · PNG · WEBP · 2 MB MAX</span>
      </label>}
      {status && status !== 'Uploading avatar…' && status !== 'Avatar updated.' && <p className="profile-avatar-dialog-status" role="status" aria-live="polite">{status}</p>}
      <div className="profile-avatar-dialog-actions">
        {cropDraft
          ? <><button type="button" className="profile-avatar-cancel" disabled={uploading} onClick={() => dialogRef.current?.close()}>Cancel</button>
            <button type="button" className="profile-avatar-save" disabled={uploading} onClick={() => void confirmCrop()}>
              {uploading ? <LoaderCircle className="animate-spin" size={16} aria-hidden="true" /> : <Camera size={16} aria-hidden="true" />}
              {uploading ? 'Uploading…' : 'Save avatar'}
            </button></>
          : <button type="button" className="profile-avatar-cancel" disabled={uploading} onClick={() => dialogRef.current?.close()}>Cancel</button>}
      </div>
    </dialog>
  </div>
}
