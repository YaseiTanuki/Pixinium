'use client'

import { ImagePlus, Trash2, Upload } from 'lucide-react'
import { acceptedFileTypes, type AttachmentInput } from '@/lib/admin/content'
import { ASSET_PACK_LIMITS, CONTENT_LIMITS } from '@/lib/admin/limits'

interface Props {
  attachments: AttachmentInput[]
  ready: boolean
  upload: (files: FileList | null, kind: 'cover' | 'pack-image') => Promise<void>
  remove: (paths: string[]) => Promise<void>
  editLabel: (path: string, label: string) => void
}

export function AssetUploadFields({ attachments, ready, upload, remove, editLabel }: Props) {
  const cover = attachments.filter(asset => asset.role === 'cover')
  const images = attachments.filter(asset => asset.role === 'download')

  function attachmentFields(asset: AttachmentInput, index: number) {
    return (
      <div className="studio-attachment" key={asset.path}>
        <p className="account-help">
          {asset.fileName || `Image ${index + 1}`}
          {asset.role === 'download' && index < ASSET_PACK_LIMITS.previews && ' · Included in page preview'}
        </p>
        <label>
          Image description
          <input className="account-input" value={asset.altText} maxLength={CONTENT_LIMITS.attachmentLabel}
            onChange={event => editLabel(asset.path, event.target.value)} />
        </label>
        <button type="button" className="account-text-link" onClick={() => void remove([asset.path])}>
          <Trash2 size={14} aria-hidden="true" /> Remove image
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
      <section className="workspace-panel" aria-labelledby="asset-images-title">
        <h2 id="asset-images-title">Pack images</h2>
        <p className="workspace-muted">
          All images are bundled into one ZIP at their original quality. The first {ASSET_PACK_LIMITS.previews} images appear in the preview section.
        </p>
        <label className="studio-file-picker">
          <Upload size={20} aria-hidden="true" /> Upload images
          <input className="account-input" type="file" multiple accept={acceptedFileTypes('image')}
            disabled={!ready || images.length >= ASSET_PACK_LIMITS.images}
            onChange={event => { void upload(event.target.files, 'pack-image'); event.target.value = '' }} />
          <span className="account-help">
            Up to {ASSET_PACK_LIMITS.images} pack images plus one thumbnail, {CONTENT_LIMITS.fileMegabytes} MB per file.
          </span>
        </label>
        {images.map(attachmentFields)}
      </section>
    </>
  )
}
