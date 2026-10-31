'use client'

import { Trash2, Upload } from 'lucide-react'
import { AssetUploadFields } from '@/components/asset-upload-fields'
import { MusicUploadFields } from '@/components/music-upload-fields'
import { GameUploadFields } from '@/components/game-upload-fields'
import type { UploadKind } from '@/components/use-content-uploads'
import { fileType, acceptedFileTypes, type AttachmentInput } from '@/lib/admin/content'
import { CONTENT_LIMITS } from '@/lib/admin/limits'

type Props = {
  kind: { isMusic: boolean; isGame: boolean; isAssetPack: boolean }
  attachments: AttachmentInput[]
  ready: boolean
  upload: (files: FileList | null, kind?: UploadKind) => Promise<void>
  remove: (paths: string[]) => Promise<void>
  editLabel: (path: string, label: string) => void
}

/** File pickers for the category being edited; each category accepts a different set of files. */
export function ContentFileFields({ kind, attachments, ready, upload, remove, editLabel }: Props) {
  if (kind.isAssetPack) return <AssetUploadFields attachments={attachments} ready={ready} upload={upload} remove={remove} editLabel={editLabel} />
  if (kind.isMusic) return <MusicUploadFields attachments={attachments} ready={ready} upload={upload} remove={remove} editLabel={editLabel} />
  if (kind.isGame) return <GameUploadFields attachments={attachments} ready={ready} upload={upload} remove={remove} editLabel={editLabel} />
  return <section className="workspace-panel"><h2>Original files & thumbnail</h2><p className="workspace-muted">Upload the original files for download. We automatically create a smaller display thumbnail from the first image.</p>
    <label className="studio-file-picker"><Upload size={20} aria-hidden="true" /> Upload files<input className="account-input" type="file" multiple accept={acceptedFileTypes()} disabled={!ready} onChange={e => { void upload(e.target.files); e.target.value = '' }} /><span className="account-help">Up to {CONTENT_LIMITS.files} files, {CONTENT_LIMITS.fileMegabytes} MB each. Use ZIP for game packages. Files stay private until the item is published.</span></label>
    {attachments.map(asset => <div className="studio-attachment" key={asset.path}><div className="studio-grid">
      <p className="account-help">Original download{fileType(asset.path)?.mediaType === 'image' && attachments.find(a => fileType(a.path)?.mediaType === 'image')?.path === asset.path ? ' · Thumbnail generated automatically' : ''}</p>
      <label>Description / download label<input className="account-input" value={asset.altText} maxLength={CONTENT_LIMITS.attachmentLabel} onChange={e => editLabel(asset.path, e.target.value)} /></label>
    </div><button type="button" className="account-text-link" onClick={() => void remove([asset.path])}><Trash2 size={14} aria-hidden="true" /> Remove attachment</button></div>)}
  </section>
}
