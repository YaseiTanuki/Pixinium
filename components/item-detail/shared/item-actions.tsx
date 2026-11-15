import Image from 'next/image'
import { ChevronDown, Download, ExternalLink, Globe, LockKeyhole } from 'lucide-react'
import type { CatalogDetail } from '@/lib/entities/catalog'
import type { DownloadOption } from '@/lib/download-sources'
import { SaveItemButton } from './save-item-button'
import { formatByteSize } from '@/lib/media-details'
import { SWF_MIME } from '@/lib/game-swf'
import { CONTENT_SCHEMAS } from '@/lib/content-types'

function SourceMark({ source }: { source: DownloadOption }) {
  const hostname = source.url && URL.canParse(source.url) ? new URL(source.url).hostname : ''
  const logo = source.kind === 'internal' ? '/brand/pixinium-crystal.svg'
    : hostname === 'github.com' ? '/brand/download-sources/github.svg'
    : hostname === 'archive.org' ? '/brand/download-sources/internet-archive.svg' : null
  return <span className="detail-mirror-logo" aria-hidden="true">
    {logo ? <Image src={logo} alt="" width={28} height={28} unoptimized /> : <Globe size={28} />}
  </span>
}

function PixiniumDownload({ downloads, source, mirror = false, zipSwf = false }: { downloads: CatalogDetail['media']; source: DownloadOption; mirror?: boolean; zipSwf?: boolean }) {
  const single = downloads.length === 1 ? downloads[0] : undefined
  if (!downloads.length) return null
  if (single) return <a className={mirror ? 'detail-mirror-tile' : 'detail-download-button'} href={single.url} title={mirror ? `${source.name}${formatByteSize(single.byteSize) ? ` · ${formatByteSize(single.byteSize)}` : ''}` : undefined}>
    {mirror ? <><SourceMark source={source} /><span className="detail-mirror-name">{source.name}</span></> : <>
      <Download size={19} aria-hidden="true" />
      {single.mimeType === 'application/zip' || (zipSwf && single.mimeType === SWF_MIME) ? 'Download ZIP' : 'Download original'}
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

function DownloadAction({ source, downloads, mirror = false, zipSwf = false }: { source: DownloadOption; downloads: CatalogDetail['media']; mirror?: boolean; zipSwf?: boolean }) {
  if (source.kind === 'internal') return <PixiniumDownload downloads={downloads} source={source} mirror={mirror} zipSwf={zipSwf} />
  return <a className={mirror ? 'detail-mirror-tile' : 'detail-download-button'} href={source.url} title={mirror ? source.name : undefined}>
    {mirror ? <><SourceMark source={source} /><span className="detail-mirror-name">{source.name}</span></> : <>
      <ExternalLink size={19} aria-hidden="true" /> Download on {source.name}
    </>}
  </a>
}

export function ItemActions({ item }: { item: CatalogDetail }) {
  const downloads = item.media.filter(asset => asset.role === 'download')
  const zipSwf = item.category.metadataSchemaKey === CONTENT_SCHEMAS.game
  const [primary, ...mirrors] = [...(item.downloadSources ?? [])]
    .filter(source => !item.noDirectDownload || source.kind !== 'internal')
    .sort((a, b) => a.priority - b.priority || a.provider.localeCompare(b.provider))
  return <div className="detail-actions">
    {primary ? <DownloadAction source={primary} downloads={downloads} zipSwf={zipSwf} />
      : <button type="button" className="detail-download-button" disabled><LockKeyhole size={19} aria-hidden="true" /> Download not available</button>}
    <SaveItemButton itemId={item.item.id} />
    {mirrors.length > 0 && <div className="detail-mirrors" aria-label="Other download sources">
      <span className="detail-mirrors-label">or download from other source</span>
      <div className="detail-mirror-grid">{mirrors.map(source => <DownloadAction key={source.provider} source={source} downloads={downloads} mirror zipSwf={zipSwf} />)}</div>
    </div>}
  </div>
}
