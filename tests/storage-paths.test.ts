import { test } from 'node:test'
import assert from 'node:assert/strict'
import { itemStorageDirectory } from '../lib/admin/storage-paths'

test('storage roots follow category and preserve bigint item identity', () => {
  assert.equal(itemStorageDirectory('images', '123'), 'image/123')
  assert.equal(itemStorageDirectory('music', '123'), 'audio/123')
  assert.equal(itemStorageDirectory('games', '9007199254740993'), 'game/9007199254740993')
  assert.equal(itemStorageDirectory('fonts', '9'), 'fonts/9')
})
test('storage identity rejects traversal and invalid IDs', () => {
  for (const category of ['../image', 'image/test', '']) assert.throws(() => itemStorageDirectory(category, '1'))
  for (const id of ['0', '-1', '1/other', '1.5', '']) assert.throws(() => itemStorageDirectory('images', id))
})
