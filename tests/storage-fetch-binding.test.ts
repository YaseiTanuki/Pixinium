import assert from 'node:assert/strict'
import test from 'node:test'
import { STORAGE_FETCH_BINDING, withStorageFetch } from '../server/services/storage-fetch-binding'

test('S3 binding preserves native fetch and no-store even when app wrappers discard cache options', async () => {
  let calls = 0
  const nativeFetch: typeof fetch = async (input, init) => {
    calls++
    assert.equal(init?.cache, 'no-store')
    assert.equal(init?.redirect, 'manual')
    const request = new Request(input, init)
    assert.equal(request.method, 'HEAD')
    assert.equal(request.headers.get('if-match'), '"original-etag"')
    assert.equal(new URL(request.url).searchParams.get('X-Amz-Signature'), 'test-signature')
    return new Response(null, { status: 200 })
  }
  const scheduled = () => 'preserved'
  const originalEnv = { OTHER_BINDING: {}, RUNTIME_SECRET: 'not-logged' }
  const context = {}
  const worker = withStorageFetch({ scheduled, async fetch(_request: Request, env: Record<string, unknown>, ctx: unknown) {
    assert.equal(ctx, context)
    assert.equal(env.OTHER_BINDING, originalEnv.OTHER_BINDING)
    assert.equal(env.RUNTIME_SECRET, originalEnv.RUNTIME_SECRET)
    const transport = env[STORAGE_FETCH_BINDING] as { fetch: typeof fetch }
    // Reproduce OpenNext stripping cache from init; the binding restores it
    // directly at the captured native fetch, beyond the app's wrappers.
    const init: RequestInit = { method: 'HEAD', cache: 'no-store', headers: { 'if-match': '"original-etag"' } }
    delete init.cache
    return transport.fetch('https://storage.example.invalid/file?X-Amz-Signature=test-signature', init)
  } }, nativeFetch)
  assert.equal((await worker.fetch(new Request('https://pixinium.example'), originalEnv, context)).status, 200)
  assert.equal(calls, 1)
  assert.equal(worker.scheduled, scheduled)
  assert.equal(STORAGE_FETCH_BINDING in originalEnv, false)
})
