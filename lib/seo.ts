import type { Metadata, MetadataRoute } from 'next'
import type { CatalogDetail } from './entities/catalog'
import { categoryHref, itemHref } from './catalog'
import { itemSeoImage } from './item-image'

export const SITE_NAME = 'Pixinium'
export const SITE_TITLE = 'Pixinium — Your little archive'
export const SITE_DESCRIPTION = 'Discover a curated collection of wallpapers, music, games and creative assets. Find something to save, enjoy and make your own.'

export function siteOrigin(): URL {
  const url = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://pixinium.com')
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('NEXT_PUBLIC_SITE_URL must be a public HTTP(S) URL.')
  return new URL(url.origin)
}

export function absoluteUrl(path: string): string {
  return new URL(path, siteOrigin()).href
}

export function indexingAllowed(): boolean {
  return process.env.SEO_NOINDEX !== 'true' && (!process.env.VERCEL_ENV || process.env.VERCEL_ENV === 'production')
}

export function robotsConfiguration(): MetadataRoute.Robots {
  if (!indexingAllowed()) return { rules: { userAgent: '*', disallow: '/' } }
  return { rules: { userAgent: '*', allow: '/', disallow: ['/api/agent/', '/api/uploads/', '/api/profile/', '/auth/'] }, sitemap: absoluteUrl('/sitemap.xml') }
}

export function pageMetadata({ title, description, path, index = true, image }: {
  title: string; description: string; path: string; index?: boolean; image?: { url: string; alt: string; width?: number; height?: number }
}): Metadata {
  const allowIndex = index && indexingAllowed()
  const images = image ? [{ ...image, url: absoluteUrl(image.url) }] : [{ url: absoluteUrl('/share-image'), alt: SITE_TITLE, width: 1200, height: 630 }]
  return {
    title, description,
    ...(index ? { alternates: { canonical: absoluteUrl(path) } } : {}),
    robots: { index: allowIndex, follow: true, 'max-image-preview': 'large' },
    openGraph: { type: 'website', siteName: SITE_NAME, title, description, url: absoluteUrl(path), images, locale: 'en_US' },
    twitter: { card: 'summary_large_image', title, description, images },
  }
}

export function itemMetadata(item: CatalogDetail): Metadata {
  const image = itemSeoImage(item)
  return pageMetadata({ title: item.item.title, description: item.item.summary || item.description.slice(0, 160) || `Explore ${item.item.title} in the ${item.category.name.toLowerCase()} collection on Pixinium.`, path: itemHref(item),
    image: image ? { url: image.url, alt: image.altText || item.item.title,
      ...(image.width && image.width > 0 ? { width: image.width } : {}),
      ...(image.height && image.height > 0 ? { height: image.height } : {}) } : undefined })
}

export function breadcrumbData(entries: { name: string; path: string }[]) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: entries.map((entry, index) => ({ '@type': 'ListItem', position: index + 1, name: entry.name, item: absoluteUrl(entry.path) })) }
}

export function itemStructuredData(item: CatalogDetail) {
  const image = itemSeoImage(item)
  return [breadcrumbData([{ name: 'Home', path: '/' }, { name: item.category.name, path: categoryHref(item.category.slug) }, { name: item.item.title, path: itemHref(item) }]),
    { '@context': 'https://schema.org', '@type': 'CreativeWork', name: item.item.title, description: item.item.summary || item.description, url: absoluteUrl(itemHref(item)), ...(image ? { image: absoluteUrl(image.url) } : {}), keywords: item.tags.map(tag => tag.name).join(', '), isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: absoluteUrl('/') } },
    ...(image && item.media?.some(asset => asset.role === 'download' && asset.mediaType === 'image') ? [{
      '@context': 'https://schema.org', '@type': 'ImageObject', '@id': `${absoluteUrl(itemHref(item))}#image`,
      contentUrl: absoluteUrl(image.url), url: absoluteUrl(image.url), name: item.item.title,
      caption: image.altText || item.item.title, representativeOfPage: true,
      ...(image.width && image.width > 0 ? { width: image.width } : {}),
      ...(image.height && image.height > 0 ? { height: image.height } : {}),
    }] : [])]
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}
