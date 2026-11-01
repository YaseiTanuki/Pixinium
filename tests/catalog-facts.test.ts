import assert from 'node:assert/strict'
import test from 'node:test'
import { catalogFacts } from '../lib/catalog-facts'
import { CONTENT_SCHEMAS, usesAutomaticFacts } from '../lib/content-types'
import type { CatalogDetail, ItemFact } from '../lib/entities/catalog'

const media = [
  { role: 'cover', mediaType: 'image', width: 450, height: 800, mimeType: 'image/webp' },
  { role: 'download', mediaType: 'image', width: 1080, height: 1920, mimeType: 'image/png' },
  { role: 'download', mediaType: 'audio', durationSeconds: 125, mimeType: 'audio/mpeg' },
  { role: 'download', mediaType: 'file', mimeType: 'application/zip' },
] as CatalogDetail['media']

test('only image facts are automatic; every other schema permits manual editing', () => {
  assert.equal(usesAutomaticFacts(CONTENT_SCHEMAS.image), true)
  for (const schema of [CONTENT_SCHEMAS.music, CONTENT_SCHEMAS.asset, CONTENT_SCHEMAS.game, 'future.v2', undefined]) {
    assert.equal(usesAutomaticFacts(schema), false)
  }
})

for (const schema of [CONTENT_SCHEMAS.music, CONTENT_SCHEMAS.asset, CONTENT_SCHEMAS.game, 'future.v2']) {
  test(`${schema} preserves manual facts, including values that differ from file metadata`, () => {
    const facts: ItemFact[] = [
      { itemId: '1', key: 'format', label: 'Format', value: 'Custom format', sortOrder: 0 },
      { itemId: '1', key: 'duration', label: 'Duration', value: 'Extended edition', sortOrder: 1 },
      { itemId: '1', key: 'creator', label: 'Creator', value: 'Independent artist', sortOrder: 2 },
    ]
    assert.deepEqual(catalogFacts(schema, '1', media, facts), facts)
    assert.deepEqual(catalogFacts(schema, '1', media, []), [])
  })
}

test('images still derive resolution and format from the original download', () => {
  const stored: ItemFact[] = [{ itemId: '1', key: 'creator', label: 'Creator', value: 'Pixinium', sortOrder: 0 }]
  assert.deepEqual(catalogFacts(CONTENT_SCHEMAS.image, '1', media, stored).map(fact => [fact.key, fact.value]), [
    ['resolution', '1080 × 1920 px'], ['format', 'PNG'], ['creator', 'Pixinium'],
  ])
})
