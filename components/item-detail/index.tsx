import Link from 'next/link'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { MotionDiv, MotionNav, MotionSection } from '@/components/motion'
import { SiteFooter } from '@/components/site-footer'
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
  const description = item.description.trim() || item.item.summary.trim()
  return (
    <div className="home-page item-detail-page">
      <a className="skip-home" href="#item-main">Skip to content</a>
      <SiteHeader />
      <main id="item-main" className="home-shell">
        <MotionNav className="detail-breadcrumb" aria-label="Breadcrumb" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45 }}>
          <Link href="/search"><ArrowLeft size={14} aria-hidden="true" /> The archive</Link>
          <ChevronRight size={12} aria-hidden="true" />
          <Link href={categoryHref(item.category.slug)}>{item.category.name}</Link>
          <ChevronRight size={12} aria-hidden="true" />
          <span aria-current="page">{item.item.title}</span>
        </MotionNav>

        <MotionDiv className="detail-hero" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}>
          <DetailMedia key={item.item.id} item={item} />
          <ItemInformation item={item} />
        </MotionDiv>

        {contentKind(item.category.metadataSchemaKey) === 'asset' && <AssetPackPreview item={item} />}

        <MotionSection className="detail-about" aria-labelledby="about-title" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}>
          <div>
            <h2 id="about-title">Description<span>.</span></h2>
          </div>
          <div>
            <p>{description || 'No description has been added yet.'}</p>
          </div>
        </MotionSection>
        <RelatedItems items={related} />
      </main>
      <SiteFooter />
    </div>
  )
}
