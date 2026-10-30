import Link from 'next/link'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { BrandLogo } from '@/components/brand-logo'
import type { CatalogCard, CatalogDetail } from '@/lib/entities/catalog'
import { contentKind, type ContentKind } from '@/lib/content-types'
import { categoryHref } from '@/lib/catalog'
import type { ComponentType } from 'react'
import { ItemInformation } from './shared/item-information'
import { RelatedItems } from './shared/related-items'
import { ImageDetail } from './variants/image-detail'
import { MusicDetail } from './variants/music-detail'
import { GameDetail } from './variants/game-detail'
import { AssetDetail } from './variants/asset-detail'
import { AssetPackPreview } from './variants/asset-pack-preview'

interface ItemDetailProps {
  item: CatalogDetail
  related: CatalogCard[]
}

const detailVariants = {
  image: ImageDetail,
  music: MusicDetail,
  game: GameDetail,
  asset: AssetDetail,
} satisfies Record<ContentKind, ComponentType<{ item: CatalogDetail }>>

// Resolve by the persisted schema so renamed category slugs keep their behavior.
function DetailMedia({ item }: { item: CatalogDetail }) {
  const Variant = detailVariants[contentKind(item.category.metadataSchemaKey)]
  return <Variant item={item} />
}

export default function ItemDetail({ item, related }: ItemDetailProps) {
  return (
    <div className="home-page item-detail-page">
      <a className="skip-home" href="#item-main">Skip to content</a>
      <SiteHeader />
      <main id="item-main" className="home-shell">
        <nav className="detail-breadcrumb" aria-label="Breadcrumb">
          <Link href="/search"><ArrowLeft size={14} aria-hidden="true" /> The archive</Link>
          <ChevronRight size={12} aria-hidden="true" />
          <Link href={categoryHref(item.category.slug)}>{item.category.name}</Link>
          <ChevronRight size={12} aria-hidden="true" />
          <span aria-current="page">{item.item.title}</span>
        </nav>

        <div className="detail-hero">
          <DetailMedia key={item.item.id} item={item} />
          <ItemInformation item={item} />
        </div>

        {contentKind(item.category.metadataSchemaKey) === 'asset' && <AssetPackPreview item={item} />}

        {item.description && item.description !== item.item.summary && <section className="detail-about" aria-labelledby="about-title">
          <div>
            <p className="eyebrow">ABOUT THIS FIND</p>
            <h2 id="about-title">A closer look<span>.</span></h2>
          </div>
          <div>
            <p>{item.description}</p>
          </div>
        </section>}
        <RelatedItems items={related} />
      </main>
      <footer className="home-footer home-shell">
        <BrandLogo className="brand-logo-footer" />
        <p>A little archive. A lot to love.</p>
        <Link href="/search">Back to the good stuff ↑</Link>
      </footer>
    </div>
  )
}
