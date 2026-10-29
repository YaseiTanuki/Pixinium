import assert from 'node:assert/strict'
import test from 'node:test'
import { formatByteSize, formatDuration } from '../lib/media-details'
import { musicFacts } from '../lib/music-facts'
import type { CatalogDetail } from '../lib/entities/catalog'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MusicPlayer } from '../components/music-player'

test('file sizes support bigint precision, zero and absent legacy values', () => {
  assert.equal(formatByteSize('0'), '0 B')
  assert.equal(formatByteSize('1536'), '1.5 KiB')
  assert.equal(formatByteSize('1048576'), '1 MiB')
  assert.equal(formatByteSize('9223372036854775807'), '8 EiB')
  for (const value of [undefined, null, '', '-1', 'NaN']) assert.equal(formatByteSize(value), null)
})

test('track times retain zero and handle hour and rounding boundaries', () => {
  assert.equal(formatDuration(0), '0:00')
  assert.equal(formatDuration(59.8), '1:00')
  assert.equal(formatDuration(3661), '1:01:01')
  for (const value of [undefined, null, NaN, Infinity, -1]) assert.equal(formatDuration(value), null)
})

test('music displays recorded metadata and retains custom facts without duplicating generated ones', () => {
  const stored = [
    { itemId: '1', key: 'duration', label: 'Duration', value: 'Old value', sortOrder: 0 },
    { itemId: '1', key: 'license', label: 'License', value: 'CC0', sortOrder: 1 },
  ]
  assert.deepEqual(musicFacts('1', { track_count: 2, duration_seconds: 125, formats: ['mp3', 'flac'] }, [], stored).map(f => f.value),
    ['2', '2:05', 'MP3, FLAC', 'CC0'])
})

test('legacy music uses measured assets and does not fabricate missing durations', () => {
  const media = [{ role: 'download', mediaType: 'audio', durationSeconds: 61 },
    { role: 'download', mediaType: 'audio', durationSeconds: 64 }] as CatalogDetail['media']
  assert.deepEqual(musicFacts('1', {}, media, []).map(f => f.value), ['2', '2:05'])
  delete media[1].durationSeconds
  assert.deepEqual(musicFacts('1', {}, media, []).map(f => f.value), ['2'])
})

test('music player renders each persisted track duration', () => {
  const item = {
    item: { id: '1', title: 'Test album', accentColor: '#ffffff' }, cover: null,
    media: [{ id: '1', role: 'download', mediaType: 'audio', url: '/api/assets/1', altText: 'First track', durationSeconds: 125 },
      { id: '2', role: 'download', mediaType: 'audio', url: '/api/assets/2', altText: 'Second track', durationSeconds: null }],
  } as CatalogDetail
  const html = renderToStaticMarkup(createElement(MusicPlayer, { item }))
  assert.match(html, /music-track-duration[^>]*>2:05</)
  assert.equal((html.match(/class="music-track-duration"/g) ?? []).length, 1)
  assert.match(html, /First track/)
  assert.match(html, /Second track/)
})
