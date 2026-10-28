import Home from '@/components/home'
import { randomInt } from 'node:crypto'
import { CONTENT_SCHEMAS } from '@/lib/content-types'
import { listCatalogItems, listCategories, listContentUses } from '@/server/services/catalog.service'
export const dynamic = 'force-dynamic'
export default async function Page({ searchParams }: { searchParams: Promise<{ collection?: string }> }) {
 const { collection } = await searchParams
 const [items, categories, uses] = await Promise.all([listCatalogItems(), listCategories(), listContentUses()])
 const images = items.filter(card => card.category.metadataSchemaKey === CONTENT_SCHEMAS.image && card.cover)
 const music = items.filter(card => card.category.artworkStyle === 'record')
 // Pick on the server so hydration and client-side filters keep the same hero.
 const spotlightId = images.length ? images[randomInt(images.length)].item.id : null
 const musicId = music.length ? music[randomInt(music.length)].item.id : null
 return <Home key={collection ?? ''} items={items} categories={categories} uses={uses} spotlightId={spotlightId} musicId={musicId} initialFilter={collection === 'saved' ? 'saved' : ''} />
}
