import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)

test('OAuth providers share callback, require signup consent, and block concurrent attempts', async () => {
  const values = []
  const requests = []
  let cursor = 0
  let fail = false
  const source = readFileSync(new URL('../components/auth-form.tsx', import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  })
  const mocks = {
    react: {
      useActionState: () => [{}, () => {}, false],
      useState: initial => {
        const index = cursor++
        if (!(index in values)) values[index] = initial
        return [values[index], value => { values[index] = value }]
      },
    },
    '@/app/actions/auth': { login() {}, signup() {} },
    '@/lib/supabase/client': { createClient: () => ({ auth: {
      signInWithOAuth: async request => {
        requests.push(request)
        return fail ? { data: {}, error: new Error('unavailable') } : { data: { url: 'https://provider.example' }, error: null }
      },
    } }) },
  }
  const exports = {}
  vm.runInNewContext(outputText, {
    exports, require: name => mocks[name] ?? require(name), window: { location: { origin: 'https://pixinium.test' } },
  })
  function render(mode = 'signup') { cursor = 0; return exports.AuthForm({ mode }) }
  function nodes(node) {
    if (!node || typeof node !== 'object') return []
    return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)]
  }
  const button = (tree, provider) => nodes(tree).find(node => node.props?.title === `Continue with ${provider}`)
  let tree = render()
  assert.equal(button(tree, 'GitHub').props.disabled, true)
  await button(tree, 'GitHub').props.onClick()
  assert.equal(requests.length, 0)
  nodes(tree).find(node => node.props?.name === 'termsAccepted').props.onChange({ target: { checked: true } })
  tree = render()
  assert.equal(button(tree, 'GitHub').props.disabled, false)
  await button(tree, 'GitHub').props.onClick()
  assert.equal(requests[0].provider, 'github')
  assert.equal(requests[0].options.redirectTo, 'https://pixinium.test/auth/callback')
  tree = render()
  assert.equal(button(tree, 'Google').props.disabled, true)
  await button(tree, 'Google').props.onClick()
  assert.equal(requests.length, 1)
  values[0] = null
  fail = true
  await button(render('login'), 'Google').props.onClick()
  assert.equal(requests[1].provider, 'google')
  assert.equal(values[0], null)
  assert.match(values[2], /Google/)
})
