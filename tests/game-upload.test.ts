import test from 'node:test'
import assert from 'node:assert/strict'
import { unzipSync } from 'fflate'
import { validateGameFiles, isPlayableGame } from '../lib/admin/game'
import { validateSwf, SWF_MIME } from '../lib/game-swf'
import { gameDownloadZip } from '../lib/game-download'

test('games accept one thumbnail and one SWF or ZIP, with incomplete drafts allowed', () => {
  const image = { path: 'cover.png' }
  for (const path of ['game.zip', 'game.SWF']) {
    assert.equal(validateGameFiles([image, { path }], true), undefined)
    assert.ok(validateGameFiles([{ path }], true))
  }
  assert.equal(validateGameFiles([], false), undefined)
  assert.equal(validateGameFiles([image], false), undefined)
  assert.ok(validateGameFiles([image], true))
  assert.ok(validateGameFiles([image, { path: 'other.jpg' }, { path: 'game.swf' }], false))
  assert.ok(validateGameFiles([image, { path: 'game.swf' }, { path: 'game.zip' }], true))
  for (const path of ['song.mp3', 'document.pdf', 'game.exe', 'unknown']) assert.ok(validateGameFiles([image, { path }], false))
})

test('only a stored SWF download with the play-able tag enables the player', () => {
  const tags = [{ slug: 'play-able' }]
  assert.equal(isPlayableGame(tags, [{ role: 'download', mimeType: SWF_MIME }]), true)
  assert.equal(isPlayableGame([], [{ role: 'download', mimeType: SWF_MIME }]), false)
  assert.equal(isPlayableGame(tags, [{ role: 'download', mimeType: 'application/zip' }]), false)
  assert.equal(isPlayableGame(tags, [{ role: 'preview', mimeType: SWF_MIME }]), false)
})

test('SWF validation keeps original bytes and rejects unsupported payloads', () => {
  for (const first of [70, 67, 90]) {
    const swf = new Uint8Array([first, 87, 83, 9, 8, 0, 0, 0])
    const before = swf.slice()
    validateSwf(swf)
    assert.deepEqual(swf, before)
  }
  for (const bytes of [new Uint8Array(), new Uint8Array([70, 87, 83]), new TextEncoder().encode('<html>bad</html>')]) {
    assert.throws(() => validateSwf(bytes), /valid SWF/)
  }
})

test('download creates a ZIP stream containing unchanged SWF across multiple chunks', async () => {
  const swf = new Uint8Array(256 * 1024).map((_, index) => index % 251)
  let offset = 0
  const source = new ReadableStream<Uint8Array>({ pull(controller) {
    if (offset === swf.length) { controller.close(); return }
    const end = Math.min(offset + 4096, swf.length)
    controller.enqueue(swf.slice(offset, end))
    offset = end
  } })
  const zip = new Uint8Array(await new Response(gameDownloadZip(source, 'game-46.swf')).arrayBuffer())
  const files = unzipSync(zip)
  assert.deepEqual(Object.keys(files), ['game-46.swf'])
  assert.deepEqual(files['game-46.swf'], swf)
})

test('download cancellation stops reading the original and storage errors propagate', async () => {
  let cancelled = false
  const source = new ReadableStream<Uint8Array>({ cancel() { cancelled = true } })
  await gameDownloadZip(source, 'game-1.swf').cancel()
  assert.equal(cancelled, true)
  const failed = new ReadableStream<Uint8Array>({ start(controller) { controller.error(new Error('Storage interrupted')) } })
  await assert.rejects(new Response(gameDownloadZip(failed, 'game-1.swf')).arrayBuffer(), /Storage interrupted/)
})
