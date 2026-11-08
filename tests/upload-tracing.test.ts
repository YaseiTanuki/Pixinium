import assert from 'node:assert/strict'
import test from 'node:test'
import { Readable } from 'node:stream'
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { setUploadTraceContext } from '../lib/upload-tracing'
import { addStorageTracing } from '../server/services/storage-tracing'

test('trace context allows only explicit attributes and tolerates unavailable tracing', () => {
  const captured: Record<string, unknown> = {}
  const span = { setAttribute(name: string, value: unknown) { captured[name] = value } }
  setUploadTraceContext({ 'agent.id': 'agent-id', 'upload.stage': 'finalize_files',
    authorization: 'Bearer private-token', 'session.id': 'private-session', 'agent.token': 'private-token',
    'storage.signed_headers': 'x'.repeat(257), 'storage.response_status': NaN }, span)
  assert.deepEqual(captured, { 'agent.id': 'agent-id', 'upload.stage': 'finalize_files' })
  assert.doesNotThrow(() => setUploadTraceContext({ 'agent.id': 'agent-id' }))
  assert.doesNotThrow(() => setUploadTraceContext({ 'agent.id': 'agent-id' }, {
    setAttribute() { throw new Error('unavailable') },
  }))
})

test('S3 tracing captures signature header names and error context without credentials or file paths', async () => {
  const captured: Record<string, unknown> = {}
  const span = { setAttribute(name: string, value: unknown) { captured[name] = value } }
  const storage = new S3Client({ region: 'ap-southeast-1', endpoint: 'https://storage.example.invalid', forcePathStyle: true,
    credentials: { accessKeyId: 'private-access-key', secretAccessKey: 'private-secret-key' }, maxAttempts: 1,
    requestHandler: { async handle() {
      return { response: { statusCode: 403, headers: { 'content-type': 'application/xml', 'x-amz-request-id': 'safe-request-id' },
        body: Readable.from(['<Error><Code>SignatureDoesNotMatch</Code><Message>private-provider-message</Message></Error>']) } }
    } },
  })
  addStorageTracing(storage, attributes => setUploadTraceContext(attributes, span))
  await assert.rejects(storage.send(new GetObjectCommand({ Bucket: 'pixinium', Key: 'staging/private-object.png', IfMatch: '"private-etag"' })),
    { name: 'SignatureDoesNotMatch' })
  assert.equal(captured['storage.failed_operation'], 'GetObjectCommand')
  assert.equal(captured['storage.response_status'], 403)
  assert.equal(captured['upload.error.provider'], 'SignatureDoesNotMatch')
  assert.equal(captured['storage.request_id'], 'safe-request-id')
  assert.equal(captured['storage.if_match'], true)
  assert.equal(captured['storage.if_match_quoted'], true)
  assert.ok(String(captured['storage.signed_headers']).split(';').includes('if-match'))
  assert.match(String(captured['storage.object_id']), /^[0-9a-f]{16}$/)
  assert.ok(!JSON.stringify(captured).includes('private'))
  const signed = new URL(await getSignedUrl(storage, new PutObjectCommand({ Bucket: 'pixinium', Key: 'staging/new.png',
    ContentType: 'image/png', ContentLength: 1 }), { expiresIn: 60 }))
  assert.ok(signed.searchParams.has('X-Amz-Signature'))
})
