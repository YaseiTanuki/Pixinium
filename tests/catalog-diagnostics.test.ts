import assert from 'node:assert/strict'
import test from 'node:test'
import { catalogDiagnostic, withCatalogDiagnostics } from '../lib/catalog-diagnostics'

const connection = 'postgresql://runtime:private-password@private-host/neondb'

test('catalog diagnostics classify configuration without serializing credentials', () => {
  assert.equal(catalogDiagnostic(new Error('missing config'), undefined).configuration, 'missing')
  for (const invalid of ['not a URL', `psql '${connection}'`, `'${connection}'`, 'https://example.com/db']) {
    assert.equal(catalogDiagnostic(new Error(invalid), invalid).configuration, 'invalid')
  }
  assert.equal(catalogDiagnostic(new Error('test'), connection).configuration, 'present')
})

test('catalog diagnostics distinguish authentication, privileges, schema and transport failures', () => {
  for (const [code, category] of [['28P01', 'authentication'], ['42501', 'permission'],
    ['42P01', 'schema'], ['53300', 'connection_limit'], ['57014', 'timeout']]) {
    assert.equal(catalogDiagnostic({ code, message: `private SQL ${connection}` }, connection).category, category)
  }
  assert.equal(catalogDiagnostic({ cause: { code: 'ENOTFOUND' } }, connection).category, 'network')
  const diagnostic = catalogDiagnostic({ code: connection, message: connection, detail: 'private SQL' }, connection)
  assert.equal(diagnostic.code, 'unknown')
  assert.ok(!JSON.stringify(diagnostic).includes('private'))
})

test('catalog read failures emit safe JSON and preserve the original exception', async () => {
  const previousConnection = process.env.DATABASE_URL
  const previousError = console.error
  const logged: unknown[][] = []
  process.env.DATABASE_URL = connection
  console.error = (...args) => { logged.push(args) }
  try {
    const error = Object.assign(new Error(`SELECT password FROM private_table ${connection}`), { code: '42501' })
    await assert.rejects(withCatalogDiagnostics('home', async () => { throw error }), caught => caught === error)
    assert.equal(logged.length, 1)
    const log = String(logged[0][0])
    assert.deepEqual(JSON.parse(log), { event: 'catalog.read.failed', operation: 'home',
      configuration: 'present', code: '42501', category: 'permission' })
    assert.ok(!/private|password|SELECT/.test(log))
    assert.equal(await withCatalogDiagnostics('catalog_api', async () => 42), 42)
    assert.equal(logged.length, 1)
  } finally {
    console.error = previousError
    if (previousConnection === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = previousConnection
  }
})
