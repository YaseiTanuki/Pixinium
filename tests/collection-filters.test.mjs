import assert from 'node:assert/strict'
import test from 'node:test'
import { filterSavedItems } from '../lib/collection-filters.ts'

test('saved collection filters combine types, tags and text without changing saved order', () => {
  const card = (id, title, category, tags, views = 0, downloads = 0) => ({
    item: { id, title, summary: `${category} collection` }, category: { slug: category, name: category },
    tags: tags.map(slug => ({ id: slug, slug, name: slug })), viewCount: views, downloadCount: downloads,
  })
  const saved = [card('1', 'Moon Cat', 'images', ['cat', 'moon'], 5), card('2', 'Piano Moon', 'music', ['moon'], 20, 10), card('3', 'Cat Garden', 'games', ['cat'], 2, 30)]
  const all = { category: '', tag: '', sort: '', tagMatch: 'all', query: '' }
  const ids = filters => filterSavedItems(saved, { ...all, ...filters }).map(item => item.item.id)
  assert.deepEqual(ids({}), ['1', '2', '3'])
  assert.deepEqual(ids({ category: 'images,music', tag: 'moon' }), ['1', '2'])
  assert.deepEqual(ids({ tag: 'cat moon' }), ['1'])
  assert.deepEqual(ids({ tag: 'cat moon', tagMatch: 'any' }), ['1', '2', '3'])
  assert.deepEqual(ids({ query: 'PIANO' }), ['2'])
  assert.deepEqual(ids({ query: 'moon', category: 'games' }), [])
  assert.deepEqual(ids({ sort: 'oldest' }), ['3', '2', '1'])
  assert.deepEqual(ids({ sort: 'views' }), ['2', '1', '3'])
  assert.deepEqual(ids({ sort: 'downloads' }), ['3', '2', '1'])
  assert.deepEqual(ids({ sort: 'title' }), ['3', '1', '2'])
  assert.deepEqual(saved.map(item => item.item.id), ['1', '2', '3'])
  assert.deepEqual(filterSavedItems(saved.slice(1), { ...all, tag: 'cat moon' }), [])
})
