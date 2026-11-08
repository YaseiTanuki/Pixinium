import assert from 'node:assert/strict'
import test from 'node:test'
import { Readable } from 'node:stream'
import { S3Client } from '@aws-sdk/client-s3'
import { inspectStorageObject } from '../server/services/storage-inspection'

function fixture(headStatus: number, getStatus = 206, range = 'bytes 0-0/2108456') {
  const requests: Array<{ method: string; path: string; range?: string }> = []
  const storage = new S3Client({ region: 'ap-southeast-1', endpoint: 'https://storage.example.invalid', forcePathStyle: true,
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' }, maxAttempts: 1,
    requestHandler: { async handle(request: { method: string; path: string; headers: Record<string, string> }) {
      requests.push({ method: request.method, path: request.path, range: request.headers.range })
      const isHead = request.method === 'HEAD'
      const statusCode = isHead ? headStatus : getStatus
      const denied = statusCode === 403
      return { response: { statusCode, headers: denied ? { 'content-type': 'application/xml' } : {
        'content-length': isHead ? '2108456' : '1', 'content-type': 'image/png', etag: '"original"',
        ...(!isHead ? { 'content-range': range } : {}),
      }, body: Readable.from([denied ? '<Error><Code>SignatureDoesNotMatch</Code><Message>private details</Message></Error>' : Buffer.from([1])]) } }
    } },
  })
  return { storage, requests }
}

test('successful HEAD avoids a GET', async () => {
  const { storage, requests } = fixture(200)
  const result = await inspectStorageObject(storage, 'pixinium', 'staging/owned.png')
  assert.equal(result.ContentLength, 2108456)
  assert.equal(requests.length, 1)
})

test('HEAD 403 falls back to one byte and retains full-object validators', async () => {
  const { storage, requests } = fixture(403)
  const result = await inspectStorageObject(storage, 'pixinium', 'staging/owned.png')
  assert.equal(result.ContentLength, 2108456)
  assert.equal(result.ContentType, 'image/png')
  assert.equal(result.ETag, '"original"')
  assert.deepEqual(requests[1], { method: 'GET', path: '/pixinium/staging/owned.png', range: 'bytes=0-0' })
})

test('GET denial preserves the concrete provider error instead of bypassing authorization', async () => {
  const { storage } = fixture(403, 403)
  await assert.rejects(inspectStorageObject(storage, 'pixinium', 'staging/owned.png'), { name: 'SignatureDoesNotMatch' })
})

test('inspection rejects a server that ignores or misreports the byte range', async () => {
  for (const [status, range] of [[200, 'bytes 0-0/2108456'], [206, 'bytes 0-1/2108456'], [206, 'bytes 0-0/9007199254740992']] as const) {
    const { storage } = fixture(403, status, range)
    await assert.rejects(inspectStorageObject(storage, 'pixinium', 'staging/owned.png'), /invalid byte range/)
  }
})

test('missing objects do not trigger the 403 fallback', async () => {
  const { storage, requests } = fixture(404)
  await assert.rejects(inspectStorageObject(storage, 'pixinium', 'staging/owned.png'))
  assert.equal(requests.length, 1)
})
