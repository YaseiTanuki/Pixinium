import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ItemDetail from '@/components/item-detail'
import { getCatalogItem, listCatalogItems, listCategories } from '@/server/services/catalog.service'
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
 const [items, categories] = await Promise.all([listCatalogItems({ category }), listCategories()])
 return <ItemDetail key={item.item.id} item={item} categories={categories} related={items.filter(card => card.item.id !== item.item.id).slice(0, 4)} />
}
