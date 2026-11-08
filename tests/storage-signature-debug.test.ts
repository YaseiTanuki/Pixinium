import assert from 'node:assert/strict'
import test from 'node:test'
import { Readable } from 'node:stream'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { addStorageSignatureDebug } from '../server/services/storage-signature-debug'

function fixture() {
  const storage = new S3Client({ region: 'ap-southeast-1', endpoint: 'https://storage.example.invalid', forcePathStyle: true,
    credentials: { accessKeyId: 'private-access-id', secretAccessKey: 'private-secret', sessionToken: 'private-session-token' }, maxAttempts: 1,
    requestHandler: { async handle() {
      return { response: { statusCode: 403, headers: { 'content-type': 'application/xml' },
        body: Readable.from(['<Error><Code>SignatureDoesNotMatch</Code><Message>private-message</Message><CanonicalRequest>private-server-canonical</CanonicalRequest><StringToSign>private-server-string</StringToSign></Error>']) } }
    } },
  })
  return storage
}

test('signature debug verifies the SDK signature and emits only hashes and safe context', async () => {
  const events: Array<Record<string, unknown>> = []
  const storage = fixture()
  addStorageSignatureDebug(storage, { enabled: true, emit: event => { events.push(event) } })
  await assert.rejects(storage.send(new GetObjectCommand({ Bucket: 'pixinium', Key: 'staging/private-object.png',
    Range: 'bytes=0-0', IfMatch: '"private-etag"' })), { name: 'SignatureDoesNotMatch' })
  assert.equal(events.length, 1)
  const event = events[0] as { after_signing: Record<string, unknown>; before_transport: Record<string, unknown>; canonical_unchanged_before_transport: boolean; changed_signed_headers: string[] }
  assert.equal(event.after_signing.signature_matches_local_recalculation, true)
  assert.equal(event.before_transport.signature_matches_local_recalculation, true)
  assert.equal(event.canonical_unchanged_before_transport, true)
  assert.deepEqual(event.changed_signed_headers, [])
  assert.equal(event.after_signing.has_session_token, true)
  assert.match(String(event.after_signing.credential_fingerprint), /^[a-f0-9]{64}$/)
  assert.match(String(events[0].server_canonical_request_hash), /^[a-f0-9]{64}$/)
  assert.match(String(events[0].server_string_to_sign_hash), /^[a-f0-9]{64}$/)
  assert.ok(!JSON.stringify(events).includes('private'))
})

test('signature debug detects a signed header modified before transport', async () => {
  const events: Array<Record<string, unknown>> = []
  const storage = fixture()
  addStorageSignatureDebug(storage, { enabled: true, emit: event => { events.push(event) } })
  const handler = storage.config.requestHandler
  const handle = handler.handle.bind(handler)
  handler.handle = (request, ...args) => {
    request.headers.range = 'bytes=1-1'
    return handle(request, ...args)
  }
  await assert.rejects(storage.send(new GetObjectCommand({ Bucket: 'pixinium', Key: 'staging/test.png', Range: 'bytes=0-0' })),
    { name: 'SignatureDoesNotMatch' })
  assert.equal(events[0].canonical_unchanged_before_transport, false)
  assert.deepEqual(events[0].changed_signed_headers, ['range'])
  assert.equal((events[0].after_signing as Record<string, unknown>).signature_matches_local_recalculation, true)
  assert.equal((events[0].before_transport as Record<string, unknown>).signature_matches_local_recalculation, false)
})

test('debug is opt-in and logging failures preserve the original storage error', async () => {
  const storage = fixture()
  const handle = storage.config.requestHandler.handle
  addStorageSignatureDebug(storage, { enabled: false })
  assert.equal(storage.config.requestHandler.handle, handle)
  addStorageSignatureDebug(storage, { enabled: true, emit() { throw new Error('logger unavailable') } })
  await assert.rejects(storage.send(new GetObjectCommand({ Bucket: 'pixinium', Key: 'staging/test.png' })),
    { name: 'SignatureDoesNotMatch' })
})
