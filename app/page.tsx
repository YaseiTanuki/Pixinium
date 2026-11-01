import Home from '@/components/home'
import { randomInt } from 'node:crypto'
import { CONTENT_SCHEMAS } from '@/lib/content-types'
import { listCatalogItems, listCategories } from '@/server/services/catalog.service'
import type { Metadata } from 'next'
import { JsonLd } from '@/components/json-ld'
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, pageMetadata } from '@/lib/seo'
export const metadata: Metadata = { ...pageMetadata({ title: SITE_TITLE, description: SITE_DESCRIPTION, path: '/' }), title: { absolute: SITE_TITLE } }
export const dynamic = 'force-dynamic'
export default async function Page() {
 const [items, categories] = await Promise.all([listCatalogItems(), listCategories()])
 const images = items.filter(card => card.category.metadataSchemaKey === CONTENT_SCHEMAS.image && card.cover)
 const music = items.filter(card => card.category.artworkStyle === 'record')
 // Pick on the server so hydration and client-side filters keep the same hero.
 const spotlightId = images.length ? images[randomInt(images.length)].item.id : null
 const musicId = music.length ? music[randomInt(music.length)].item.id : null
 return <><JsonLd value={{ '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME, url: absoluteUrl('/'), description: SITE_DESCRIPTION }} /><Home items={items} categories={categories} spotlightId={spotlightId} musicId={musicId} /></>
}
