import assert from 'node:assert/strict'
import test from 'node:test'
import { masonryLayout } from '../lib/masonry-layout.ts'

test('mixed image heights fill the shortest column instead of continuing down column three', () => {
  const result = masonryLayout([110, 425, 165, 230, 190], 3, 16)
  assert.deepEqual(result.positions, [
    { column: 0, top: 0 }, { column: 1, top: 0 }, { column: 2, top: 0 },
    { column: 0, top: 126 }, { column: 2, top: 181 },
  ])
  assert.equal(result.height, 425)
})

test('equal heights prefer the leftmost column and empty results collapse', () => {
  assert.deepEqual(masonryLayout([100, 100, 100, 100], 3, 14).positions[3], { column: 0, top: 114 })
  assert.deepEqual(masonryLayout([], 3, 14), { positions: [], height: 0 })
})

test('one-column layouts preserve order and omit the trailing gap', () => {
  assert.deepEqual(masonryLayout([100, 200, 150], 1, 11), {
    positions: [{ column: 0, top: 0 }, { column: 0, top: 111 }, { column: 0, top: 322 }],
    height: 472,
  })
})

test('remeasuring a loaded image changes subsequent placement', () => {
  assert.equal(masonryLayout([100, 200, 150, 90], 3, 16).positions[3].column, 0)
  assert.equal(masonryLayout([300, 200, 150, 90], 3, 16).positions[3].column, 2)
})

