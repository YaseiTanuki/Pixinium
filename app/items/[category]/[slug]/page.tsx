import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ItemDetail from '@/components/item-detail'
import { CATALOG_DISPLAY } from '@/lib/catalog'
import { getCatalogItem, listCatalogItems, recordItemView } from '@/server/services/catalog.service'
import './item-detail.css'
import { itemMetadata, itemStructuredData } from '@/lib/seo'
import { JsonLd } from '@/components/json-ld'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ category: string; slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, slug } = await params
  const item = await getCatalogItem(category, slug)
  if (!item) notFound()
  return itemMetadata(item)
}

export default async function Page({ params }: Props) {
  const { category, slug } = await params
  const item = await getCatalogItem(category, slug)
  if (!item) notFound()

  await recordItemView(item.item.id)
  const items = await listCatalogItems({ category })
  const related = items.filter(card => card.item.id !== item.item.id).slice(0, CATALOG_DISPLAY.relatedItems)

  return <><JsonLd value={itemStructuredData(item)} /><ItemDetail key={item.item.id} item={item} related={related} /></>
}
