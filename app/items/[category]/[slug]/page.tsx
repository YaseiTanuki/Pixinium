import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ItemDetail from '@/components/item-detail'
import { CATALOG_DISPLAY } from '@/lib/catalog'
import { contentKind } from '@/lib/content-types'
import { getCatalogItem, listCatalogItems, listStoryChapters } from '@/server/services/catalog.service'
import './item-detail.css'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ category: string; slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, slug } = await params
  const item = await getCatalogItem(category, slug)
  return { title: item ? `${item.item.title} | pixinium.` : 'Item not found | pixinium.' }
}

export default async function Page({ params }: Props) {
  const { category, slug } = await params
  const item = await getCatalogItem(category, slug)
  if (!item) notFound()

  const [items, chapters] = await Promise.all([
    listCatalogItems({ category }),
    contentKind(item.category.metadataSchemaKey) === 'story' ? listStoryChapters(item.item.id) : Promise.resolve([]),
  ])
  const related = items.filter(card => card.item.id !== item.item.id).slice(0, CATALOG_DISPLAY.relatedItems)

  return <ItemDetail key={item.item.id} item={item} related={related} chapters={chapters} />
}
