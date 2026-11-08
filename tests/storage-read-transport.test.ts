import assert from 'node:assert/strict'
import test from 'node:test'
import { Readable } from 'node:stream'
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { FetchHttpHandler } from '@smithy/fetch-http-handler'
import { useFetchForStorageReads } from '../server/services/storage-read-transport'
import { signatureSnapshot } from '../server/services/storage-signature-debug'

test('fetch reads preserve the SDK signature, range and conditional validators on the actual Request', async () => {
  let defaultCalls = 0
  const storage = new S3Client({ region: 'ap-southeast-1', endpoint: 'https://storage.example.invalid', forcePathStyle: true,
    credentials: { accessKeyId: 'test-access', secretAccessKey: 'test-secret' },
    requestHandler: { async handle() { defaultCalls++; throw new Error('Read used default transport') } },
  })
  const requests: Request[] = []
  const reads = new FetchHttpHandler({ customFetch: async input => {
    const request = input as Request
    requests.push(request)
    const url = new URL(request.url)
    const snapshot = await signatureSnapshot(storage, { method: request.method, protocol: url.protocol,
      hostname: url.hostname, path: url.pathname, query: Object.fromEntries(url.searchParams),
      headers: Object.fromEntries(request.headers) })
    assert.equal(snapshot?.signature_matches_local_recalculation, true)
    assert.equal(request.headers.get('if-match'), '"original-etag"')
    return request.method === 'HEAD'
      ? new Response(null, { status: 200, headers: { 'content-length': '20', etag: '"original-etag"' } })
      : new Response(Uint8Array.from([1]), { status: 206, headers: {
        'content-length': '1', 'content-range': 'bytes 0-0/20', etag: '"original-etag"', 'content-type': 'image/png',
      } })
  } })
  useFetchForStorageReads(storage, reads)
  const head = await storage.send(new HeadObjectCommand({ Bucket: 'pixinium', Key: 'staging/test.png', IfMatch: '"original-etag"' }))
  assert.equal(head.ContentLength, 20)
  const result = await storage.send(new GetObjectCommand({ Bucket: 'pixinium', Key: 'staging/test.png', Range: 'bytes=0-0', IfMatch: '"original-etag"' }))
  assert.equal(result.ContentRange, 'bytes 0-0/20')
  assert.deepEqual(await result.Body!.transformToByteArray(), Uint8Array.from([1]))
  assert.equal(requests[1].headers.get('range'), 'bytes=0-0')
  assert.equal(defaultCalls, 0)
})

test('writes retain their existing streaming transport', async () => {
  let defaultCalls = 0
  let fetchCalls = 0
  const body = Readable.from([Buffer.from('zip')])
  const storage = new S3Client({ region: 'ap-southeast-1', endpoint: 'https://storage.example.invalid', forcePathStyle: true,
    credentials: { accessKeyId: 'test-access', secretAccessKey: 'test-secret' }, requestChecksumCalculation: 'WHEN_REQUIRED',
    requestHandler: { async handle() { defaultCalls++; return { response: { statusCode: 200, headers: {}, body: Readable.from([]) } } } },
  })
  useFetchForStorageReads(storage, new FetchHttpHandler({ customFetch: async () => { fetchCalls++; throw new Error('Write used read transport') } }))
  await storage.send(new PutObjectCommand({ Bucket: 'pixinium', Key: 'pack.zip', Body: body, ContentLength: 3 }))
  assert.equal(defaultCalls, 1)
  assert.equal(fetchCalls, 0)
})
