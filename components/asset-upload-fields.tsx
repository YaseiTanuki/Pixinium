'use client'

import { ImagePlus, Trash2, Upload } from 'lucide-react'
import { acceptedFileTypes, type AttachmentInput } from '@/lib/admin/content'
import { ASSET_PACK_LIMITS, CONTENT_LIMITS } from '@/lib/admin/limits'

interface Props {
  attachments: AttachmentInput[]
  ready: boolean
  upload: (files: FileList | null, kind: 'cover' | 'pack-zip' | 'pack-preview') => Promise<void>
  remove: (paths: string[]) => Promise<void>
  editLabel: (path: string, label: string) => void
}

export function AssetUploadFields({ attachments, ready, upload, remove, editLabel }: Props) {
  const cover = attachments.filter(asset => asset.role === 'cover')
  const archives = attachments.filter(asset => asset.role === 'download')
  const previews = attachments.filter(asset => asset.role === 'preview')

  function attachmentFields(asset: AttachmentInput, index: number) {
    return (
      <div className="studio-attachment" key={asset.path}>
        <p className="account-help">
          {asset.fileName || `Image ${index + 1}`}
          {asset.role === 'preview' && ' · Page preview only'}
        </p>
        <label>
          {asset.role === 'download' ? 'Download label' : 'Image description'}
          <input className="account-input" value={asset.altText} maxLength={CONTENT_LIMITS.attachmentLabel}
            onChange={event => editLabel(asset.path, event.target.value)} />
        </label>
        <button type="button" className="account-text-link" onClick={() => void remove([asset.path])}>
          <Trash2 size={14} aria-hidden="true" /> {asset.role === 'download' ? 'Remove ZIP' : 'Remove image'}
        </button>
      </div>
    )
  }

  return (
    <>
      <section className="workspace-panel" aria-labelledby="asset-thumbnail-title">
        <h2 id="asset-thumbnail-title">Pack thumbnail</h2>
        <p className="workspace-muted">Upload a separate thumbnail for this pack. It will not be included in the ZIP.</p>
        {cover.length === 0 && (
          <label className="studio-file-picker">
            <ImagePlus size={20} aria-hidden="true" /> Upload thumbnail
            <input className="account-input" type="file" accept={acceptedFileTypes('image')} disabled={!ready}
              onChange={event => { void upload(event.target.files, 'cover'); event.target.value = '' }} />
          </label>
        )}
        {cover.map(attachmentFields)}
      </section>
      <section className="workspace-panel" aria-labelledby="asset-preview-title">
        <h2 id="asset-preview-title">Preview images</h2>
        <p className="workspace-muted">Only images uploaded here appear in the page preview. GIF animations are supported. These files are separate from the ZIP download.</p>
        <label className="studio-file-picker">
          <ImagePlus size={20} aria-hidden="true" /> Upload preview images
          <input className="account-input" type="file" multiple accept={acceptedFileTypes('image')}
            disabled={!ready || previews.length >= ASSET_PACK_LIMITS.previews}
            onChange={event => { void upload(event.target.files, 'pack-preview'); event.target.value = '' }} />
          <span className="account-help">Up to {ASSET_PACK_LIMITS.previews} preview images, {CONTENT_LIMITS.fileMegabytes} MB per file.</span>
        </label>
        {previews.map(attachmentFields)}
      </section>
      <section className="workspace-panel" aria-labelledby="asset-zip-title">
        <h2 id="asset-zip-title">Pack ZIP</h2>
        <p className="workspace-muted">
          Upload the ZIP users will download. Its contents stay unchanged; thumbnail and preview uploads are not added to it.
        </p>
        <label className="studio-file-picker">
          <Upload size={20} aria-hidden="true" /> Upload ZIP
          <input className="account-input" type="file" accept=".zip"
            disabled={!ready || archives.length >= ASSET_PACK_LIMITS.files}
            onChange={event => { void upload(event.target.files, 'pack-zip'); event.target.value = '' }} />
          <span className="account-help">
            One ZIP file, up to {CONTENT_LIMITS.fileMegabytes} MB.
          </span>
        </label>
        {archives.map(attachmentFields)}
      </section>
    </>
  )
}
