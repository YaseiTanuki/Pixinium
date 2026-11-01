import Link from 'next/link'
import { Download, Eye, FolderHeart } from 'lucide-react'
import { ItemArtwork } from '@/components/catalog-card'
import { CollectButton } from '@/components/collect-button'
import { itemHref } from '@/lib/catalog'
import type { CatalogDetail } from '@/lib/entities/catalog'

const countFormat = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

export function AssetGrid({ items }: { items: CatalogDetail[] }) {
  return <div className="category-asset-grid">{items.map(item => <article className="asset-pack-card" key={item.item.id}>
    <div className="asset-pack-tab" aria-hidden="true"><FolderHeart size={14} /></div>
    <div className="asset-pack-sleeve">
      <div className="asset-pack-paper" aria-hidden="true" />
      <Link className="asset-folder-preview" href={itemHref(item)} aria-label={`View ${item.item.title}`}><ItemArtwork item={item} /></Link>
      <div className="asset-pack-copy">
        <div className="asset-pack-title-row"><h2><Link href={itemHref(item)} title={item.item.title}>{item.item.title}</Link></h2>
          <div className="asset-pack-stats"><span title="Views" aria-label={`${item.viewCount ?? 0} views`}><Eye size={13} aria-hidden="true" />{countFormat.format(item.viewCount ?? 0)}</span><CollectButton item={item} showCount /><span title="Downloads" aria-label={`${item.downloadCount ?? 0} downloads`}><Download size={13} aria-hidden="true" />{countFormat.format(item.downloadCount ?? 0)}</span></div>
        </div>
      </div>
    </div>
  </article>)}</div>
}
