import Image from 'next/image'
import { ChevronDown, Download, ExternalLink, Globe } from 'lucide-react'
import type { CatalogDetail } from '@/lib/entities/catalog'
import type { DownloadOption } from '@/lib/download-sources'
import { SaveItemButton } from './save-item-button'
import { formatByteSize } from '@/lib/media-details'

function SourceMark({ source }: { source: DownloadOption }) {
  const hostname = source.url && URL.canParse(source.url) ? new URL(source.url).hostname : ''
  const logo = source.kind === 'internal' ? '/brand/pixinium-crystal.svg'
    : hostname === 'github.com' ? '/brand/download-sources/github.svg'
    : hostname === 'archive.org' ? '/brand/download-sources/internet-archive.svg' : null
  return <span className="detail-mirror-logo" aria-hidden="true">
    {logo ? <Image src={logo} alt="" width={28} height={28} unoptimized /> : <Globe size={28} />}
  </span>
}

function PixiniumDownload({ downloads, source, mirror = false }: { downloads: CatalogDetail['media']; source: DownloadOption; mirror?: boolean }) {
  const single = downloads.length === 1 ? downloads[0] : undefined
  if (!downloads.length) return null
  if (single) return <a className={mirror ? 'detail-mirror-tile' : 'detail-download-button'} href={single.url} title={mirror ? `${source.name}${formatByteSize(single.byteSize) ? ` · ${formatByteSize(single.byteSize)}` : ''}` : undefined}>
    {mirror ? <><SourceMark source={source} /><span className="detail-mirror-name">{source.name}</span></> : <>
      <Download size={19} aria-hidden="true" />
      {single.mimeType === 'application/zip' ? 'Download ZIP' : 'Download original'}
      {formatByteSize(single.byteSize) && <span> · {formatByteSize(single.byteSize)}</span>}
    </>}
  </a>
  return <details className={`detail-download-menu${mirror ? ' detail-download-mirror' : ''}`}>
    <summary className={mirror ? 'detail-mirror-tile' : 'detail-download-button'} title={mirror ? `${source.name}: choose from ${downloads.length} files` : undefined}>
      {mirror ? <><SourceMark source={source} /><span className="detail-mirror-name">{source.name}</span><span className="detail-mirror-count">{downloads.length}<ChevronDown size={11} aria-hidden="true" /></span></> : <>
        <Download size={19} aria-hidden="true" /> Download ({downloads.length})
        <ChevronDown size={16} aria-hidden="true" />
      </>}
    </summary>
    <ul>{downloads.map((asset, index) => <li key={asset.id}>
      <a href={asset.url}>{asset.altText || `File ${index + 1}`}{formatByteSize(asset.byteSize) && <span> · {formatByteSize(asset.byteSize)}</span>}</a>
    </li>)}</ul>
  </details>
}

function DownloadAction({ source, downloads, mirror = false }: { source: DownloadOption; downloads: CatalogDetail['media']; mirror?: boolean }) {
  if (source.kind === 'internal') return <PixiniumDownload downloads={downloads} source={source} mirror={mirror} />
  return <a className={mirror ? 'detail-mirror-tile' : 'detail-download-button'} href={source.url} title={mirror ? source.name : undefined}>
    {mirror ? <><SourceMark source={source} /><span className="detail-mirror-name">{source.name}</span></> : <>
      <ExternalLink size={19} aria-hidden="true" /> Download on {source.name}
    </>}
  </a>
}

export function ItemActions({ item }: { item: CatalogDetail }) {
  const downloads = item.media.filter(asset => asset.role === 'download')
  const [primary, ...mirrors] = [...(item.downloadSources ?? [])].sort((a, b) => a.priority - b.priority || a.provider.localeCompare(b.provider))
  return <div className="detail-actions">
    {primary && <DownloadAction source={primary} downloads={downloads} />}
    <SaveItemButton itemId={item.item.id} />
    {mirrors.length > 0 && <div className="detail-mirrors" aria-label="Other download sources">
      <span className="detail-mirrors-label">or download from other source</span>
      <div className="detail-mirror-grid">{mirrors.map(source => <DownloadAction key={source.provider} source={source} downloads={downloads} mirror />)}</div>
    </div>}
  </div>
}
