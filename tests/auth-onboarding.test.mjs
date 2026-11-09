import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)

function home(account) {
  let accountReads = 0
  let catalogReads = 0
  const mocks = {
    'next/navigation': { redirect: path => { throw Object.assign(new Error('redirect'), { path }) } },
    '@/server/services/auth.service': { getAccount: async () => { accountReads++; return account } },
    '@/components/home': { default: () => null },
    '@/components/json-ld': { JsonLd: () => null },
    '@/lib/content-types': { CONTENT_SCHEMAS: { image: 'images.v1' } },
    '@/lib/catalog-diagnostics': { withCatalogDiagnostics: (_name, run) => run() },
    '@/server/services/catalog.service': {
      listCatalogItems: async () => { catalogReads++; return [] },
      listCategories: async () => { catalogReads++; return [] },
    },
    '@/lib/seo': { pageMetadata: () => ({}), absoluteUrl: path => `https://pixinium.test${path}` },
  }
  const { outputText } = ts.transpileModule(readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  })
  const exports = {}
  vm.runInNewContext(outputText, { exports, URLSearchParams, require: name => mocks[name] ?? require(name) })
  return {
    visit: (params = {}) => exports.default({ searchParams: Promise.resolve(params) }),
    reads: () => ({ accountReads, catalogReads }),
  }
}

test('OAuth code returned to Site URL is exchanged before checking the account or loading the archive', async () => {
  const page = home(null)
  await assert.rejects(page.visit({ code: 'code+with&characters' }), error => {
    assert.equal(error.path, '/auth/callback?code=code%2Bwith%26characters')
    return true
  })
  assert.deepEqual(page.reads(), { accountReads: 0, catalogReads: 0 })
})

test('unfinished accounts stay in username setup on every home visit until a username is saved', async () => {
  const account = { username: null }
  const page = home(account)
  for (let visit = 0; visit < 2; visit++) {
    await assert.rejects(page.visit(), error => error.path === '/choose-username')
  }
  assert.equal(page.reads().catalogReads, 0)
  account.username = 'little_cloud'
  assert.ok(await page.visit())
  assert.equal(page.reads().catalogReads, 2)
})

test('guests can still open the archive', async () => {
  const page = home(null)
  assert.ok(await page.visit())
  assert.equal(page.reads().catalogReads, 2)
})

test('OAuth failures returned to Site URL show login retry instead of the archive or code exchange', async () => {
  const page = home({ username: null })
  for (const params of [
    { error: 'invalid_request', error_code: 'bad_oauth_state', error_description: 'private provider details' },
    { error_code: 'bad_oauth_state' },
    { error: 'access_denied', code: 'must-not-exchange' },
  ]) {
    await assert.rejects(page.visit(params), error => error.path === '/login?error=oauth')
  }
  assert.deepEqual(page.reads(), { accountReads: 0, catalogReads: 0 })
})
