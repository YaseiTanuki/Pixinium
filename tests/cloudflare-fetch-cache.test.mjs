import assert from 'node:assert/strict'
import test from 'node:test'
import { preserveNoStore } from '../scripts/cloudflare-fetch-cache.mjs'

test('preserves no-store in both generated OpenNext fetch and Request wrappers', () => {
  const source = 'function fetchWrapper(init2) { delete init2.cache; }\nfunction requestWrapper(init2) { delete init2.cache; }'
  const result = preserveNoStore(source)
  assert.equal((result.match(/if \(init2\.cache !== 'no-store'\) delete init2\.cache;/g) ?? []).length, 2)
})

test('fails closed if the generated OpenNext initialization changes', () => {
  assert.throws(() => preserveNoStore('delete init2.cache;'), /Unexpected OpenNext initialization/)
  assert.throws(() => preserveNoStore('delete init2.cache; delete init2.cache; delete init2.cache;'), /Unexpected OpenNext initialization/)
})
