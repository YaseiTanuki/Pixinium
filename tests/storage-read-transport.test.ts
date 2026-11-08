import assert from 'node:assert/strict'
import test from 'node:test'
import { Readable } from 'node:stream'
import { createHash, createHmac } from 'node:crypto'
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getCanonicalHeaders, getCanonicalQuery } from '@smithy/signature-v4'
import { usePresignedStorageReads } from '../server/services/storage-read-transport'

test('presigned reads verify independently and retain range and conditional validators on the actual Request', async () => {
  let defaultCalls = 0
  const storage = new S3Client({ region: 'ap-southeast-1', endpoint: 'https://storage.example.invalid', forcePathStyle: true,
    credentials: { accessKeyId: 'test-access', secretAccessKey: 'test-secret' },
    requestHandler: { async handle() { defaultCalls++; throw new Error('Read used default transport') } },
  })
  const requests: Request[] = []
  usePresignedStorageReads(storage, async input => {
    const request = input as Request
    requests.push(request)
    const url = new URL(request.url)
    const signedNames = url.searchParams.get('X-Amz-SignedHeaders')!
    const signed = new Set(signedNames.split(';'))
    const candidate = { method: request.method, protocol: url.protocol,
      hostname: url.hostname, path: url.pathname, query: Object.fromEntries(url.searchParams),
      headers: Object.fromEntries(request.headers) }
    const excluded = new Set(Object.keys(candidate.headers).filter(name => !signed.has(name)))
    const canonicalHeaders = getCanonicalHeaders(candidate, excluded, signed)
    const canonical = [request.method, url.pathname, getCanonicalQuery(candidate),
      Object.keys(canonicalHeaders).sort().map(name => `${name}:${canonicalHeaders[name]}`).join('\n') + '\n',
      signedNames, 'UNSIGNED-PAYLOAD'].join('\n')
    const hash = (value: string) => createHash('sha256').update(value).digest('hex')
    const credential = url.searchParams.get('X-Amz-Credential')!.split('/')
    const scope = credential.slice(1).join('/')
    const stringToSign = ['AWS4-HMAC-SHA256', url.searchParams.get('X-Amz-Date'), scope, hash(canonical)].join('\n')
    let key = Buffer.from('AWS4test-secret')
    for (const part of credential.slice(1)) key = createHmac('sha256', key).update(part).digest()
    assert.equal(createHmac('sha256', key).update(stringToSign).digest('hex'), url.searchParams.get('X-Amz-Signature'))
    assert.equal(url.searchParams.get('X-Amz-Expires'), '30')
    assert.equal(request.headers.has('authorization'), false)
    assert.equal(request.headers.has('amz-sdk-request'), false)
    assert.equal(request.redirect, 'manual')
    assert.equal(request.cache, 'no-store')
    assert.equal(request.headers.get('if-match'), '"original-etag"')
    return request.method === 'HEAD'
      ? new Response(null, { status: 200, headers: { 'content-length': '20', etag: '"original-etag"' } })
      : new Response(Uint8Array.from([1]), { status: 206, headers: {
        'content-length': '1', 'content-range': 'bytes 0-0/20', etag: '"original-etag"', 'content-type': 'image/png',
      } })
  })
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
  usePresignedStorageReads(storage, async () => { fetchCalls++; throw new Error('Write used read transport') })
  await storage.send(new PutObjectCommand({ Bucket: 'pixinium', Key: 'pack.zip', Body: body, ContentLength: 3 }))
  assert.equal(defaultCalls, 1)
  assert.equal(fetchCalls, 0)
})

test('presigned reads still propagate storage permission failures', async () => {
  let requests = 0
  const storage = new S3Client({ region: 'ap-southeast-1', endpoint: 'https://storage.example.invalid', forcePathStyle: true,
    credentials: { accessKeyId: 'test-access', secretAccessKey: 'test-secret' }, maxAttempts: 1,
  })
  usePresignedStorageReads(storage, async () => {
    requests++
    return new Response('<Error><Code>AccessDenied</Code><Message>Denied</Message></Error>', {
      status: 403, headers: { 'content-type': 'application/xml' },
    })
  })
  await assert.rejects(storage.send(new GetObjectCommand({ Bucket: 'pixinium', Key: 'staging/test.png' })), { name: 'AccessDenied' })
  assert.equal(requests, 1)
})

test('Workers-compatible manual mode rejects redirects without following them', async () => {
  let requests = 0
  let cancelled = false
  const storage = new S3Client({ region: 'ap-southeast-1', endpoint: 'https://storage.example.invalid', forcePathStyle: true,
    credentials: { accessKeyId: 'test-access', secretAccessKey: 'test-secret' }, maxAttempts: 1,
  })
  usePresignedStorageReads(storage, async input => {
    requests++
    assert.equal((input as Request).redirect, 'manual')
    return new Response(new ReadableStream({ cancel() { cancelled = true } }), {
      status: 307, headers: { location: 'https://other.example.invalid/file' },
    })
  })
  await assert.rejects(storage.send(new GetObjectCommand({ Bucket: 'pixinium', Key: 'staging/test.png' })),
    /Storage read redirects are not allowed/)
  assert.equal(requests, 1)
  assert.equal(cancelled, true)
})
