import { cache } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ItemDetail from '@/components/item-detail'
import { listArchiveItems } from '@/server/services/archive.service'
import './item-detail.css'

export const dynamic = 'force-dynamic'
const getItems = cache(listArchiveItems)
type Props = { params: Promise<{ slug: string }> }

function itemTitle(slug: string) {
  try {
    return decodeURIComponent(slug)
  } catch {
    notFound()
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const item = (await getItems()).find((entry) => entry.title === itemTitle(slug))
  return { title: item ? `${item.title} | pixinium.` : 'Item not found | pixinium.' }
}

export default async function ItemPage({ params }: Props) {
  const { slug } = await params
  const items = await getItems()
  const item = items.find((entry) => entry.title === itemTitle(slug))
  if (!item) notFound()
  const related = items.filter((entry) => entry.title !== item.title)
    .sort((a, b) => Number(b.category === item.category) - Number(a.category === item.category))
    .slice(0, 4)
  return <ItemDetail key={item.title} item={item} related={related} />
}
