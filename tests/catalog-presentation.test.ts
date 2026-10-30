import assert from 'node:assert/strict'
import test from 'node:test'
import { contentKind } from '../lib/content-types'
import { categoryHref, itemHref, searchHref } from '../lib/catalog'
import { playbackUrl } from '../lib/media'
import { acceptedFileTypes, contentSchema, fileType } from '../lib/admin/content'
import { CONTENT_LIMITS, MAX_ATTACHMENT_COUNT } from '../lib/admin/limits'
import type { CatalogCard } from '../lib/entities/catalog'

test('category behavior follows the schema rather than a renamed slug', () => {
  const category = { slug: 'soundtracks', metadataSchemaKey: 'music.v1' }
  assert.equal(contentKind(category.metadataSchemaKey), 'music')
  assert.equal(contentKind('stories.v1'), 'story')
  for (const schema of [undefined, 'future.v2', 'toString', '__proto__']) {
    assert.equal(contentKind(schema), 'asset')
  }
})

test('catalog URLs encode values without allowing extra query parameters or path segments', () => {
  const query = 'cozy & night/#?'
  const use = 'custom&use=music'
  const url = new URL(searchHref({ use, query }), 'https://example.test')
  assert.equal(url.searchParams.get('q'), query)
  assert.deepEqual(url.searchParams.getAll('use'), [use])
  assert.equal(searchHref(), '/search')
  const categoryUrl = new URL(categoryHref('custom/type', { query, page: 3 }), 'https://example.test')
  assert.equal(categoryUrl.pathname, '/custom%2Ftype')
  assert.equal(categoryUrl.searchParams.get('q'), query)
  assert.equal(categoryUrl.searchParams.get('page'), '3')
  assert.equal(categoryHref('music', { page: 1 }), '/music')
  assert.equal(categoryHref('stories'), '/stories')
  const card = { category: { slug: 'custom/type' }, item: { slug: 'title?#' } } as CatalogCard
  assert.equal(itemHref(card), '/items/custom%2Ftype/title%3F%23')
})

test('playback preserves query and fragment, replaces the flag and leaves signed external URLs intact', () => {
  assert.equal(playbackUrl('/api/assets/1?token=abc&play=0#track'), '/api/assets/1?token=abc&play=1#track')
  assert.equal(playbackUrl(playbackUrl('/api/assets/1')), '/api/assets/1?play=1')
  for (const url of ['https://cdn.test/audio.mp3?signature=a%2Fb', '//cdn.test/api/assets/1', '/audio/track.mp3']) {
    assert.equal(playbackUrl(url), url)
  }
})

test('file picker options agree with supported upload types', () => {
  for (const kind of ['image', 'audio'] as const) {
    for (const extension of acceptedFileTypes(kind).split(',')) {
      assert.equal(fileType(`upload${extension}`)?.mediaType, kind)
    }
  }
  assert.ok(acceptedFileTypes().includes('.zip'))
  assert.ok(!acceptedFileTypes('image').includes('.svg'))
})

test('content validation enforces the shared attachment and text limits at the boundary', () => {
  const attachments = Array.from({ length: MAX_ATTACHMENT_COUNT + 1 }, (_, index) => ({
    path: `00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-${String(index).padStart(12, '0')}.png`,
    altText: 'Artwork',
  }))
  const item = {
    categoryId: '1', title: 'A'.repeat(CONTENT_LIMITS.title), summary: '', description: '',
    accentColor: '#ffffff', isFeatured: false, sortOrder: 0, metadata: {}, tags: [], facts: [],
    attachments: attachments.slice(0, MAX_ATTACHMENT_COUNT),
  }
  assert.equal(contentSchema.safeParse(item).success, true)
  assert.equal(contentSchema.safeParse({ ...item, attachments }).success, false)
  assert.equal(contentSchema.safeParse({ ...item, title: `${item.title}A` }).success, false)
})
