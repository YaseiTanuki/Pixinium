import assert from 'node:assert/strict'
import test from 'node:test'
import { absoluteUrl, breadcrumbData, indexingAllowed, itemMetadata, itemStructuredData, pageMetadata, serializeJsonLd, robotsConfiguration as robots } from '../lib/seo.ts'
import { imageViewUrl } from '../lib/media.ts'
import { itemSeoImage } from '../lib/item-image.ts'

test('public metadata uses the production origin and result filters can opt out of indexing', () => {
  assert.equal(absoluteUrl('/images?page=2'), 'https://pixinium.com/images?page=2')
  const metadata = pageMetadata({ title: 'Images — Page 2', description: 'Images', path: '/images?page=2' })
  assert.equal(metadata.alternates.canonical, 'https://pixinium.com/images?page=2')
  assert.equal(metadata.openGraph.url, 'https://pixinium.com/images?page=2')
  const filtered = pageMetadata({ title: 'Search', description: 'Search', path: '/search', index: false })
  assert.equal(filtered.robots.index, false)
  assert.equal(filtered.robots.follow, true)
  assert.equal(filtered.alternates, undefined)
  assert.equal(robots().sitemap, 'https://pixinium.com/sitemap.xml')
  // Do not prevent crawlers from reading the noindex on public search results.
  assert.ok(!robots().rules.disallow.includes('/search'))
})

test('Images SEO uses original download bytes and dimensions, not the cover thumbnail', () => {
  const item = { item: { slug: 'moon-cat', title: 'Moon Cat', summary: '' }, description: '', category: { slug: 'images', name: 'Images', metadataSchemaKey: 'images.v1' },
    cover: { url: '/api/assets/123', altText: 'Thumbnail', width: 800, height: 450 }, tags: [],
    media: [{ role: 'cover', mediaType: 'image', url: '/api/assets/123' },
      { role: 'download', mediaType: 'image', url: '/api/assets/124', altText: 'Original moon cat', width: 3840, height: 2160, focalX: 50, focalY: 50 }] }
  const original = 'https://pixinium.com/api/assets/124?view=1'
  const metadata = itemMetadata(item)
  assert.equal(metadata.openGraph.images[0].url, original)
  assert.equal(metadata.twitter.images[0].url, original)
  assert.equal(metadata.openGraph.images[0].width, 3840)
  assert.equal(metadata.openGraph.images[0].height, 2160)
  assert.equal(metadata.robots['max-image-preview'], 'large')
  const [, work, image] = itemStructuredData(item)
  assert.equal(work.image, original)
  assert.equal(image['@type'], 'ImageObject')
  assert.equal(image.contentUrl, original)
  assert.equal(image.width, 3840)
  assert.equal(itemSeoImage(item).url, '/api/assets/124?view=1')
  const missing = { ...item, media: [] }
  assert.equal(itemSeoImage(missing), null)
  assert.equal(itemStructuredData(missing)[1].image, undefined)
  assert.equal(imageViewUrl('/api/assets/1?token=abc#photo'), '/api/assets/1?token=abc&view=1#photo')
  assert.equal(imageViewUrl('https://cdn.test/photo.png?signature=a%2Fb'), 'https://cdn.test/photo.png?signature=a%2Fb')
})

test('preview deployments cannot accidentally override the indexing exclusion', () => {
  const before = process.env.VERCEL_ENV
  try {
    process.env.VERCEL_ENV = 'preview'
    assert.equal(indexingAllowed(), false)
    assert.equal(pageMetadata({ title: 'Test', description: 'Test', path: '/' }).robots.index, false)
    assert.equal(robots().rules.disallow, '/')
  } finally {
    if (before === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = before
  }
})

test('item metadata and structured data reflect the actual item without inventing product claims', () => {
  const item = { item: { slug: 'moon-cat', title: 'Moon Cat', summary: 'A moonlit wallpaper' }, description: 'Long description', category: { slug: 'images', name: 'Images' }, cover: { url: '/api/assets/123', altText: 'Cat under the moon' }, tags: [{ name: 'Cat' }] }
  const metadata = itemMetadata(item)
  assert.equal(metadata.description, item.item.summary)
  assert.equal(metadata.alternates.canonical, 'https://pixinium.com/items/images/moon-cat')
  assert.equal(metadata.openGraph.images[0].url, 'https://pixinium.com/api/assets/123')
  const [breadcrumbs, work] = itemStructuredData(item)
  assert.equal(breadcrumbs.itemListElement.length, 3)
  assert.equal(work['@type'], 'CreativeWork')
  assert.equal(work.offers, undefined)
  assert.equal(work.image, 'https://pixinium.com/api/assets/123')
  const unsafe = { name: '</script><script>alert(1)</script>' }
  const serialized = serializeJsonLd(unsafe)
  assert.ok(!serialized.includes('<'))
  assert.deepEqual(JSON.parse(serialized), unsafe)
  assert.equal(breadcrumbData([{ name: 'Home', path: '/' }]).itemListElement[0].position, 1)
})
