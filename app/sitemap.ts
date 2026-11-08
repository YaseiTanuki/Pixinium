import type { MetadataRoute } from 'next'
import { absoluteUrl, indexingAllowed } from '@/lib/seo'
import { listCategories } from '@/server/services/catalog.service'
import { listSitemapItems } from '@/server/services/catalog-seo.service'
import { categoryHref } from '@/lib/catalog'
import { POLICIES, POLICY_RELEASE, policyHref } from '@/lib/policies'

// Read the active runtime backend, rather than embedding a build-time catalog.
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!indexingAllowed()) return []
  const [categories, items] = await Promise.all([listCategories(), listSitemapItems()])
  return [
    { url: absoluteUrl('/') },
    ...POLICIES.map(policy => ({ url: absoluteUrl(policyHref(policy.slug)), lastModified: POLICY_RELEASE.updatedAt })),
    ...categories.map(category => ({ url: absoluteUrl(categoryHref(category.slug)) })),
    // Item updated_at also changes for counters; omit lastmod until it tracks content edits only.
    ...items.map(item => ({ url: absoluteUrl(`/items/${encodeURIComponent(item.category)}/${encodeURIComponent(item.slug)}`),
      ...(item.images.length ? { images: item.images.map(absoluteUrl) } : {}) })),
  ]
}
