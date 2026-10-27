import type { CatalogDetail } from '@/lib/entities/catalog'
import { ASSET_PACK_LIMITS } from '@/lib/admin/limits'

export function AssetPackPreview({ item }: { item: CatalogDetail }) {
  const previews = item.media.filter(asset => asset.role === 'preview' && asset.mediaType === 'image')
    .slice(0, ASSET_PACK_LIMITS.previews)

  if (previews.length === 0) return null

  return (
    <section className="asset-pack-preview" aria-labelledby="asset-pack-preview-title">
      <p className="eyebrow">INSIDE THE PACK</p>
      <h2 id="asset-pack-preview-title">Preview</h2>
      <div className="asset-pack-preview-row" tabIndex={0} role="region" aria-label="Pack image previews">
        {previews.map((asset, index) => (
          <img key={asset.id} src={asset.url} alt={asset.altText || `Pack image ${index + 1}`}
            width={asset.width ?? 800} height={asset.height ?? 800} loading="lazy" />
        ))}
      </div>
    </section>
  )
}
