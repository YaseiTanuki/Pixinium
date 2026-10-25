'use client'

import { Music2, Trash2, Upload } from 'lucide-react'
import { fileType, fileTypes, type AttachmentInput } from '@/lib/admin/content'

type Props = {
  attachments: AttachmentInput[]
  ready: boolean
  upload: (files: FileList | null, kind: 'image' | 'audio') => Promise<void>
  remove: (paths: string[]) => Promise<void>
  editLabel: (path: string, label: string) => void
}

const accepted = (kind: 'image' | 'audio') => Object.entries(fileTypes)
  .filter(([, type]) => type.mediaType === kind).map(([ext]) => `.${ext}`).join(',')

export function MusicUploadFields({ attachments, ready, upload, remove, editLabel }: Props) {
  const artwork = attachments.filter(asset => fileType(asset.path)?.mediaType === 'image')
  const tracks = attachments.filter(asset => fileType(asset.path)?.mediaType === 'audio')
  const unsupported = attachments.filter(asset => !['image', 'audio'].includes(fileType(asset.path)?.mediaType ?? ''))

  return <>
    <section className="workspace-panel" aria-labelledby="music-artwork-title">
      <h2 id="music-artwork-title">Cover artwork</h2>
      <p className="workspace-muted">Upload one image for the music thumbnail. Only the reduced thumbnail is kept.</p>
      {artwork.length === 0 && <label className="studio-file-picker"><Upload size={20} aria-hidden="true" /> Upload artwork
        <input className="account-input" type="file" accept={accepted('image')} disabled={!ready}
          onChange={event => { void upload(event.target.files, 'image'); event.target.value = '' }} />
        <span className="account-help">PNG, JPG, WebP or AVIF. Up to 50 MB.</span>
      </label>}
      {artwork.map(asset => <div className="studio-attachment" key={asset.path}>
        <label>Artwork description<input className="account-input" value={asset.altText} maxLength={300}
          onChange={event => editLabel(asset.path, event.target.value)} /></label>
        <p className="account-help">Describe the artwork for people using screen readers.</p>
        <button type="button" className="account-text-link" onClick={() => void remove([asset.path])}><Trash2 size={14} aria-hidden="true" /> Remove artwork</button>
      </div>)}
      {artwork.length > 1 && <p className="account-notice" role="alert">Keep one artwork image. Remove the extra images before saving music.</p>}
    </section>
    <section className="workspace-panel" aria-labelledby="music-tracks-title">
      <h2 id="music-tracks-title">Audio tracks</h2>
      <p className="workspace-muted">Upload the original audio for download. Track count, duration and formats are detected when you save.</p>
      <label className="studio-file-picker"><Music2 size={20} aria-hidden="true" /> Upload tracks
        <input className="account-input" type="file" multiple accept={accepted('audio')} disabled={!ready}
          onChange={event => { void upload(event.target.files, 'audio'); event.target.value = '' }} />
        <span className="account-help">MP3, WAV, FLAC, OGG or AAC. Up to 50 MB per track, 12 files including artwork.</span>
      </label>
      {tracks.map((asset, index) => <div className="studio-attachment" key={asset.path}>
        <label>Track {index + 1} download label<input className="account-input" value={asset.altText} maxLength={300}
          onChange={event => editLabel(asset.path, event.target.value)} /></label>
        <button type="button" className="account-text-link" onClick={() => void remove([asset.path])}><Trash2 size={14} aria-hidden="true" /> Remove track</button>
      </div>)}
      {unsupported.map(asset => <div className="studio-attachment" key={asset.path}>
        <p className="account-notice">{asset.altText}: this file cannot be used for music.</p>
        <button type="button" className="account-text-link" onClick={() => void remove([asset.path])}>Remove unsupported file</button>
      </div>)}
    </section>
  </>
}
