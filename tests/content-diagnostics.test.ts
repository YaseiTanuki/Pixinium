import assert from 'node:assert/strict'
import test from 'node:test'
import { contentCreateDiagnostic } from '../lib/content-diagnostics'

test('content failures retain AWS status and known identifiers without response data', () => {
  const result = contentCreateDiagnostic({ name: 'SignatureDoesNotMatch',
    message: 'Authorization secret-token https://private-storage/object',
    $metadata: { httpStatusCode: 403, requestId: 'private-request' },
    $response: { headers: { authorization: 'secret-token' } } }, 'inspect_uploads')
  assert.equal(result.stage, 'inspect_uploads')
  assert.equal(result.status, 403)
  assert.equal(result.providerError, 'SignatureDoesNotMatch')
  assert.ok(!/secret|private|Authorization/.test(JSON.stringify(result)))
})

test('content failures classify native Sharp errors without exposing the original message', () => {
  const result = contentCreateDiagnostic(new Error('Failed to load external module sharp-private-path'), 'finalize_files')
  assert.equal(result.failure, 'native_image_module')
  assert.ok(!JSON.stringify(result).includes('private-path'))
  const unknown = contentCreateDiagnostic({ name: 'secret-token', $metadata: { httpStatusCode: NaN } }, 'save_item')
  assert.equal(unknown.status, undefined)
  assert.ok(!JSON.stringify(unknown).includes('secret-token'))
})
