import assert from 'node:assert/strict'
import test from 'node:test'
import { replacementRoles, validateContentReplacement, type ExistingContentFile } from '../lib/admin/content-replacement'
import type { AttachmentInput } from '../lib/admin/content'

const upload = (extension: string, role: AttachmentInput['role'] = 'download'): AttachmentInput => ({
  path: `00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002.${extension}`,
  role, altText: 'New file', focalX: 50, focalY: 50,
})
const old = (assetId: string, role: ExistingContentFile['role'], mediaType: string, mimeType: string): ExistingContentFile => ({ assetId, role, mediaType, mimeType })
const cover = old('1', 'cover', 'image', 'image/webp')
const zip = old('2', 'download', 'file', 'application/zip')
const preview = old('3', 'preview', 'image', 'image/webp')

test('pack thumbnail, ZIP and previews can each be replaced without uploading the other groups', () => {
  for (const [attachment, roles] of [[upload('png', 'cover'), ['cover']], [upload('zip'), ['download']], [upload('gif', 'preview'), ['preview']]] as const) {
    assert.deepEqual(replacementRoles('assets.v1', [attachment]), roles)
    assert.equal(validateContentReplacement('assets.v1', [attachment], [cover, zip, preview]), undefined)
  }
  assert.ok(validateContentReplacement('assets.v1', [upload('png', 'cover')], []), 'new item still needs a ZIP')
  assert.ok(validateContentReplacement('assets.v1', [upload('zip')], [zip]), 'missing thumbnail must not be bypassed')
  assert.ok(validateContentReplacement('assets.v1', [upload('png')], [cover, zip]))
  assert.ok(validateContentReplacement('assets.v1', Array.from({ length: 6 }, () => upload('gif', 'preview')), [cover, zip]))
  assert.ok(validateContentReplacement('assets.v1', [upload('zip', 'cover')], [cover, zip]))
})

test('music and game replacements validate against retained artwork or downloads', () => {
  const audio = old('4', 'download', 'audio', 'audio/mpeg')
  assert.equal(validateContentReplacement('music.v1', [upload('png')], [cover, audio]), undefined)
  assert.deepEqual(replacementRoles('music.v1', [upload('png')]), ['cover'])
  assert.equal(validateContentReplacement('music.v1', [upload('mp3')], [cover, audio]), undefined)
  assert.deepEqual(replacementRoles('music.v1', [upload('mp3')]), ['download'])
  assert.ok(validateContentReplacement('music.v1', [upload('mp3')], []))
  assert.ok(validateContentReplacement('music.v1', [upload('zip')], [cover, audio]))
  const game = old('5', 'download', 'file', 'application/x-shockwave-flash')
  assert.equal(validateContentReplacement('games.v1', [upload('png')], [cover, game]), undefined)
  assert.equal(validateContentReplacement('games.v1', [upload('swf')], [cover, game]), undefined)
  assert.ok(validateContentReplacement('games.v1', [upload('mp3')], [cover, game]))
  assert.equal(validateContentReplacement('images.v1', [upload('pdf')], [cover]), undefined)
  assert.deepEqual(replacementRoles('images.v1', [upload('png')]), ['download', 'cover'])
  assert.deepEqual(replacementRoles('assets.v1', []), [])
})
