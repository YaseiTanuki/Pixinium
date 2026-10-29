import { ChevronDown, Download } from 'lucide-react'
import type { CatalogDetail } from '@/lib/entities/catalog'
import { SaveItemButton } from './save-item-button'
import { formatByteSize } from '@/lib/media-details'

export function ItemActions({ item }: { item: CatalogDetail }) {
  const downloads = item.media.filter(asset => asset.role === 'download')
  const single = downloads.length === 1 ? downloads[0] : undefined

  return (
    <div className="detail-actions">
      {single && (
        <a className="detail-download-button" href={single.url}>
          <Download size={19} aria-hidden="true" />
          {single.mimeType === 'application/zip' ? 'Download ZIP' : 'Download original'}
          {formatByteSize(single.byteSize) && <span> · {formatByteSize(single.byteSize)}</span>}
        </a>
      )}
      {downloads.length > 1 && (
        <details className="detail-download-menu">
          <summary className="detail-download-button">
            <Download size={19} aria-hidden="true" /> Download ({downloads.length})
            <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <ul>
            {downloads.map((asset, index) => (
              <li key={asset.id}><a href={asset.url}>{asset.altText || `File ${index + 1}`}{formatByteSize(asset.byteSize) && <span> · {formatByteSize(asset.byteSize)}</span>}</a></li>
            ))}
          </ul>
        </details>
      )}
      <SaveItemButton itemId={item.item.id} />
    </div>
  )
}
