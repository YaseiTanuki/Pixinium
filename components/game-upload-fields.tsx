'use client'

import { Trash2, Upload } from 'lucide-react'
import { fileType, fileTypes, type AttachmentInput } from '@/lib/admin/content'

type Props = {
  attachments: AttachmentInput[]
  ready: boolean
  upload: (files: FileList | null, kind: 'image' | 'game') => Promise<void>
  remove: (paths: string[]) => Promise<void>
  editLabel: (path: string, label: string) => void
}

export function GameUploadFields({ attachments, ready, upload, remove, editLabel }: Props) {
  const artwork = attachments.filter(asset => fileType(asset.path)?.mediaType === 'image')
  const packages = attachments.filter(asset => fileType(asset.path)?.extension === 'zip')
  const unsupported = attachments.filter(asset => !artwork.includes(asset) && !packages.includes(asset))
  const sections = [
    { kind: 'image' as const, title: 'Game thumbnail', label: 'Thumbnail description', assets: artwork,
      help: 'Upload one image. Only the reduced thumbnail is kept.',
      accept: Object.entries(fileTypes).filter(([, type]) => type.mediaType === 'image').map(([ext]) => `.${ext}`).join(',') },
    { kind: 'game' as const, title: 'Game file', label: 'Game download label', assets: packages,
      help: 'Upload one ZIP package containing the game files. The original package is kept for download.', accept: '.zip' },
  ]
  return <>
    {sections.map(section => <section className="workspace-panel" key={section.kind} aria-labelledby={`game-${section.kind}-title`}>
      <h2 id={`game-${section.kind}-title`}>{section.title}</h2>
      <p className="workspace-muted">{section.help}</p>
      {section.assets.length === 0 && <label className="studio-file-picker"><Upload size={20} aria-hidden="true" /> Upload {section.title.toLowerCase()}
        <input className="account-input" type="file" accept={section.accept} disabled={!ready}
          onChange={event => { void upload(event.target.files, section.kind); event.target.value = '' }} />
        <span className="account-help">One file, up to 50 MB.</span>
      </label>}
      {section.assets.map(asset => <div className="studio-attachment" key={asset.path}>
        <label>{section.label}<input className="account-input" value={asset.altText} maxLength={300}
          onChange={event => editLabel(asset.path, event.target.value)} /></label>
        <button type="button" className="account-text-link" onClick={() => void remove([asset.path])}><Trash2 size={14} aria-hidden="true" /> Remove {section.title.toLowerCase()}</button>
      </div>)}
      {section.assets.length > 1 && <p className="account-notice" role="alert">Keep only one {section.title.toLowerCase()} before saving.</p>}
    </section>)}
    {unsupported.map(asset => <div className="workspace-panel" key={asset.path}>
      <p className="account-notice">{asset.altText}: this file cannot be used for a game.</p>
      <button type="button" className="account-text-link" onClick={() => void remove([asset.path])}>Remove unsupported file</button>
    </div>)}
  </>
}
