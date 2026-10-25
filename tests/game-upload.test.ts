import test from 'node:test'
import assert from 'node:assert/strict'
import { validateGameFiles } from '../lib/admin/game'

test('games require exactly one image and one ZIP to publish, with incomplete drafts allowed', () => {
  const image = { path: 'cover.png' }, game = { path: 'game.zip' }
  assert.equal(validateGameFiles([image, game], true), undefined)
  assert.equal(validateGameFiles([], false), undefined)
  assert.equal(validateGameFiles([image], false), undefined)
  assert.ok(validateGameFiles([image], true))
  assert.ok(validateGameFiles([game], true))
  assert.ok(validateGameFiles([image, { path: 'other.jpg' }, game], false))
  assert.ok(validateGameFiles([image, game, { path: 'other.zip' }], false))
  for (const path of ['song.mp3', 'document.pdf', 'game.exe', 'unknown']) {
    assert.ok(validateGameFiles([image, { path }], false))
  }
})
