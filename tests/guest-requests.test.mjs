import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)

function loadClientModule(path, mocks, globals = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  })
  const exports = {}
  vm.runInNewContext(outputText, {
    exports, require: name => mocks[name] ?? require(name), ...globals,
  })
  return exports
}

test('guest collection makes no requests on initialization, focus, or collect; auth changes reload safely', async () => {
  let authChanged, subscribe
  let loads = 0
  let writes = 0
  let resolveLoad
  const routes = []
  const timers = new Map()
  const events = new Map()
  const store = loadClientModule('../lib/saved-items.ts', {
    react: { useSyncExternalStore: (listen, snapshot) => { subscribe = listen; return snapshot() } },
    'next/navigation': { useRouter: () => ({ push: route => routes.push(route) }) },
    '@/lib/supabase/client': { createClient: () => ({ auth: {
      onAuthStateChange: callback => {
        authChanged = callback
        return { data: { subscription: { unsubscribe() {} } } }
      },
    } }) },
    '@/app/actions/saved-items': {
      loadSavedItems: () => { loads++; return new Promise(resolve => { resolveLoad = resolve }) },
      setItemCollected: async () => { writes++; return { ids: ['1'] } },
    },
  }, {
    window: { addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name) },
    setTimeout: fn => { const key = {}; timers.set(key, fn); return key },
    clearTimeout: key => timers.delete(key),
  })
  const flush = async () => {
    for (const [key, fn] of timers) { timers.delete(key); fn() }
    await Promise.resolve()
    await Promise.resolve()
  }
  store.useSavedItems()
  const stop = subscribe(() => {})
  authChanged('INITIAL_SESSION', null)
  events.get('focus')()
  await flush()
  await store.useSavedItems().toggleSaved('1')
  assert.equal(loads, 0)
  assert.equal(writes, 0)
  assert.deepEqual(routes, ['/login?reason=collect'])
  assert.equal(store.useSavedItems().loaded, true)

  authChanged('SIGNED_IN', { user: { id: 'alice' } })
  await flush()
  assert.equal(loads, 1)
  resolveLoad({ ids: ['1'] })
  await flush()
  assert.equal(store.useSavedItems().saved[0], '1')
  authChanged('TOKEN_REFRESHED', { user: { id: 'alice' } })
  await flush()
  assert.equal(loads, 1)

  events.get('focus')()
  assert.equal(loads, 2)
  authChanged('SIGNED_OUT', null)
  resolveLoad({ ids: ['1'] })
  events.get('focus')()
  await flush()
  assert.equal(loads, 2)
  assert.equal(store.useSavedItems().saved.length, 0)
  assert.equal(store.useSavedItems().userId, null)
  stop()
  assert.equal(events.size, 0)
})

test('header only includes an avatar request for a signed-in user', () => {
  let userId = null
  const { SiteHeader } = loadClientModule('../components/site-header.tsx', {
    '@/lib/saved-items': { useSavedItems: () => ({ saved: [], error: '', userId }) },
    '@/components/brand-logo': { BrandLogo: () => null },
    'next/link': { default: ({ children }) => children },
  })
  assert.ok(!renderToStaticMarkup(require('react').createElement(SiteHeader)).includes('/api/profile/avatar'))
  userId = 'alice'
  assert.ok(renderToStaticMarkup(require('react').createElement(SiteHeader)).includes('/api/profile/avatar'))
})
