import test from 'node:test'
import assert from 'node:assert/strict'
import { readAudioMetadata } from '../server/services/audio-metadata'
import { validateMusicFiles } from '../lib/admin/music'

function wav() {
  const rate = 8000
  const dataSize = rate * 2
  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + dataSize, 4); buffer.write('WAVEfmt ', 8)
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28)
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36); buffer.writeUInt32LE(dataSize, 40)
  return buffer
}

test('audio duration and format come from original bytes', async () => {
  const original = wav()
  const snapshot = Buffer.from(original)
  assert.deepEqual(await readAudioMetadata(original, 'wav'), { format: 'wav', durationSeconds: 1 })
  assert.deepEqual(original, snapshot)
  await assert.rejects(readAudioMetadata(original, 'mp3'))
  await assert.rejects(readAudioMetadata(Buffer.from('not audio'), 'mp3'))
})

test('music needs one artwork and audio for publication; draft can be incomplete', () => {
  const artwork = { path: 'art.png' }, track = { path: 'song.mp3' }
  assert.equal(validateMusicFiles([artwork, track], true), undefined)
  assert.equal(validateMusicFiles([], false), undefined)
  assert.ok(validateMusicFiles([artwork], true))
  assert.ok(validateMusicFiles([track], true))
  assert.ok(validateMusicFiles([artwork, { path: 'other.jpg' }, track], false))
  assert.ok(validateMusicFiles([artwork, { path: 'game.zip' }], false))
})
