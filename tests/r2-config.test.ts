import assert from 'node:assert/strict'
import test from 'node:test'
import { r2Config, requirePrivateR2 } from '../lib/r2-config'

test('R2 configuration rejects legacy/malformed endpoints and requires explicit private-bucket confirmation', () => {
  const env = { R2_ENDPOINT_URL: 'https://56eb9249a6ffe1456901b2f4bb4cbc89.r2.cloudflarestorage.com',
    R2_BUCKET_NAME: 'pixinium', R2_ACCESS_KEY_ID: 'fixture', R2_SECRET_ACCESS_KEY: 'fixture-secret' }
  const config = r2Config(env)
  assert.equal(config.client.region, 'auto')
  assert.equal(config.client.endpoint, env.R2_ENDPOINT_URL)
  assert.throws(() => requirePrivateR2(config), /public development URL/)
  assert.doesNotThrow(() => requirePrivateR2(r2Config({ ...env, R2_BUCKET_PRIVATE: 'true' })))
  for (const endpoint of [env.R2_ENDPOINT_URL + '/pixinium', 'https://storage.example.invalid', env.R2_ENDPOINT_URL + '?other=1', env.R2_ENDPOINT_URL.replace('https:', 'http:')]) {
    assert.throws(() => r2Config({ ...env, R2_ENDPOINT_URL: endpoint }), /R2 account endpoint/)
  }
})
