import assert from 'node:assert/strict'
import test from 'node:test'
import { assetFacts } from '../lib/asset-facts'

test('asset properties display the complete pack quantity and ZIP download format in a fixed order', () => {
  const facts = assetFacts('15', 35, 'application/zip', 'Pixinium')
  assert.deepEqual(facts.map(({ label, value }) => [label, value]), [
    ['Quantity', '35'], ['Format', 'ZIP'], ['Creator', 'Pixinium'],
  ])
  assert.deepEqual(facts.map(fact => [fact.itemId, fact.sortOrder]), [['15', 0], ['15', 1], ['15', 2]])
})

test('missing pack metadata and preview formats do not invent download facts', () => {
  for (const count of [undefined, null, '35', 0, -1, 2.5]) {
    const facts = assetFacts('1', count, 'image/webp', ' ')
    assert.deepEqual(facts.map(fact => fact.value), ['Unavailable', 'Unavailable', 'Unknown'])
  }
})
