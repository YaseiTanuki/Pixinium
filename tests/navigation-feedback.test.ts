import assert from 'node:assert/strict'
import test from 'node:test'
import { navigationFeedback } from '../lib/navigation-feedback'

const base = 'https://pixinium.com'

test('numbered pages only skeleton the list in both directions, including the implicit first page', () => {
  assert.equal(navigationFeedback(`${base}/images`, '/images?page=2'), 'pagination-skeleton')
  assert.equal(navigationFeedback(`${base}/images?page=2`, '/images'), 'pagination-skeleton')
  assert.equal(navigationFeedback(`${base}/search?q=cat&page=1`, '/search?page=2&q=cat'), 'pagination-skeleton')
})

test('category, detail and account navigation use skeletons', () => {
  for (const target of ['/assets', '/items/images/cat', '/profile']) {
    assert.equal(navigationFeedback(`${base}/images?page=2`, target), 'skeleton')
  }
})

test('filter and search changes use skeletons even when they reset pagination', () => {
  assert.equal(navigationFeedback(`${base}/images?page=2&sort=newest`, '/images?sort=popular'), 'list-skeleton')
  assert.equal(navigationFeedback(`${base}/search?q=cat`, '/search?q=dog'), 'list-skeleton')
  assert.equal(navigationFeedback(`${base}/images`, '/images?page=invalid'), 'list-skeleton')
})

test('anchors, equivalent query strings and external links have no pending effect', () => {
  assert.equal(navigationFeedback(`${base}/profile`, '#collection'), 'none')
  assert.equal(navigationFeedback(`${base}/images?q=cat&sort=newest`, '/images?sort=newest&q=cat&page=1'), 'none')
  assert.equal(navigationFeedback(`${base}/images`, 'https://example.com/images?page=2'), 'none')
})


test('all query controls stay within their results region, including admin status and filter chips', () => {
  for (const [from, to] of [
    ['/images?q=cat', '/images'],
    ['/images?tag=wallpaper&match=all', '/images?tag=wallpaper&match=any'],
    ['/search?category=images', '/search?category=images,music'],
    ['/search?q=cat&page=2', '/search?q=dog'],
    ['/admin?status=draft#admin-collection', '/admin?status=published#admin-collection'],
    ['/admin?tag=wallpaper', '/admin?sort=oldest'],
  ]) assert.equal(navigationFeedback(`${base}${from}`, to), 'list-skeleton')
})
