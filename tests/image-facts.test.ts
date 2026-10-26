import assert from 'node:assert/strict'
import test from 'node:test'
import { imageFacts, imageCreator } from '../lib/image-facts'

test('image details always have the same three fields in order', () => {
  const facts = imageFacts('12', { width: 2400, height: 1600, mimeType: 'image/png' }, 'tanuk')
  assert.deepEqual(facts.map(({ label, value }) => [label, value]), [
    ['Resolution', '2400 \u00d7 1600 px'], ['Format', 'PNG'], ['Creator', 'tanuk'],
  ])
  assert.deepEqual(facts.map(fact => fact.sortOrder), [0, 1, 2])
})

test('legacy images keep the fixed fields without inventing dimensions or authorship', () => {
  assert.deepEqual(imageFacts('12', undefined, '').map(fact => fact.value), ['Unavailable', 'Unavailable', 'Unknown'])
  assert.equal(imageFacts('12', { width: 1200, height: null, mimeType: 'image/jpeg' }, 'name')[0].value, 'Unavailable')
})

test('creator is the uploader username or Pixinium for the trusted agent source', () => {
  assert.equal(imageCreator('studio', 'tanuk'), 'tanuk')
  assert.equal(imageCreator('agent', 'tanuk'), 'Pixinium')
  assert.equal(imageCreator('studio', null), 'Unknown')
  assert.equal(imageCreator('studio', 'adminname', 'admin'), 'Pixinium')
  assert.equal(imageCreator('studio', 'membername', 'member'), 'membername')
  assert.equal(imageFacts('12', undefined, 'AI generated')[2].value, 'Pixinium')
})
