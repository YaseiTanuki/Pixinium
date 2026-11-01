import type { MetadataRoute } from 'next'
import { absoluteUrl, indexingAllowed } from '@/lib/seo'
import { listCategories } from '@/server/services/catalog.service'
import { listSitemapItems } from '@/server/services/catalog-seo.service'
import { categoryHref } from '@/lib/catalog'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!indexingAllowed()) return []
  const [categories, items] = await Promise.all([listCategories(), listSitemapItems()])
  return [
    { url: absoluteUrl('/') },
    ...categories.map(category => ({ url: absoluteUrl(categoryHref(category.slug)) })),
    ...items.map(item => ({ url: absoluteUrl(`/items/${encodeURIComponent(item.category)}/${encodeURIComponent(item.slug)}`), lastModified: item.updatedAt })),
  ]
}
