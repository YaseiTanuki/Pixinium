import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { S3Client, ListBucketsCommand, HeadBucketCommand, GetBucketAclCommand, GetBucketPolicyCommand, GetBucketCorsCommand, PutBucketCorsCommand, PutObjectCommand, HeadObjectCommand, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

async function main() {
  const required = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_ENDPOINT_URL_S3', 'AWS_REGION']
  const missing = required.filter(key => !process.env[key])
  if (missing.length) { console.log({ missing }); process.exitCode = 1; return }
  const s3 = new S3Client({ forcePathStyle: true })
  const bucket = process.env.S3_ASSETS_BUCKET || 'assets'
  try { await s3.send(new HeadBucketCommand({ Bucket: bucket })) }
  catch (error) {
    console.log({ stage: 'HeadBucket', requestedBucket: bucket, buckets: (await s3.send(new ListBucketsCommand({}))).Buckets?.map(value => value.Name) })
    throw error
  }
  const acl = await s3.send(new GetBucketAclCommand({ Bucket: bucket }))
  assert.ok(!acl.Grants?.some(grant => grant.Grantee?.Type === 'Group' && /AllUsers|AuthenticatedUsers/.test(grant.Grantee.URI ?? '')), 'Bucket must be private')
  try {
    const policy = JSON.parse((await s3.send(new GetBucketPolicyCommand({ Bucket: bucket }))).Policy || '{}')
    const statements = Array.isArray(policy.Statement) ? policy.Statement : policy.Statement ? [policy.Statement] : []
    assert.ok(!statements.some(statement => statement.Effect === 'Allow' && JSON.stringify(statement.Principal ?? '').includes('*')), 'Bucket policy must not grant public access')
  } catch (error) { if (error.name !== 'NoSuchBucketPolicy') throw error }
  const origin = process.env.STORAGE_CHECK_ORIGIN || 'http://localhost:3000'
  let rules = []
  try { rules = (await s3.send(new GetBucketCorsCommand({ Bucket: bucket }))).CORSRules ?? [] }
  catch (error) { if (error.name !== 'NoSuchCORSConfiguration' && error.$metadata?.httpStatusCode !== 404) throw error }
  if (process.argv.includes('--configure-cors')) {
    const id = 'pixinium-admin-upload'
    const previous = rules.find(rule => rule.ID === id)
    rules = [...rules.filter(rule => rule.ID !== id), { ID: id,
      AllowedOrigins: [...new Set([...(previous?.AllowedOrigins ?? []), origin])],
      AllowedMethods: ['PUT', 'GET', 'HEAD'], AllowedHeaders: ['content-type', 'content-length'], MaxAgeSeconds: 300,
    }]
    await s3.send(new PutBucketCorsCommand({ Bucket: bucket, CORSConfiguration: { CORSRules: rules } }))
  }
  const key = `integration-check/${randomUUID()}.txt`
  const copy = `integration-check/${randomUUID()}.txt`
  const body = 'Pixinium storage verification'
  try {
    const url = await getSignedUrl(s3, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: 'text/plain', ContentLength: Buffer.byteLength(body) }),
      { expiresIn: 60, signableHeaders: new Set(['content-type', 'content-length']) })
    const preflight = await fetch(url, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'content-type' } })
    assert.ok(preflight.ok && [origin, '*'].includes(preflight.headers.get('access-control-allow-origin')), 'Upload CORS preflight failed')
    const wrongType = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body })
    assert.equal(wrongType.status, 403, 'Signed upload must reject altered content type')
    const put = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body })
    assert.ok(put.ok, `Signed upload failed (${put.status})`)
    const metadata = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    assert.equal(metadata.ContentLength, Buffer.byteLength(body))
    assert.equal(metadata.ContentType, 'text/plain')
    await s3.send(new CopyObjectCommand({ Bucket: bucket, Key: copy, CopySource: `${bucket}/${key}`, CopySourceIfMatch: metadata.ETag,
      MetadataDirective: 'REPLACE', ContentType: 'text/plain' }))
    const copied = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: copy }))
    assert.equal(copied.ETag, metadata.ETag)
    assert.equal(copied.ContentType, 'text/plain')
    assert.equal(copied.ContentLength, Buffer.byteLength(body))
    const replay = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: 'x'.repeat(Buffer.byteLength(body)) })
    assert.ok(replay.ok, 'Staging replay test failed')
    const view = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: copy }), { expiresIn: 60 })
    const get = await fetch(view)
    assert.equal(await get.text(), body)
    const anonymous = new URL(view); anonymous.search = ''
    const denied = await fetch(anonymous)
    assert.ok([401, 403, 404].includes(denied.status), 'Unsigned object access must be denied')
    console.log('PASS: private bucket, CORS, signed upload, metadata, final copy and signed download.')
  } finally {
    await Promise.all([key, copy].map(Key => s3.send(new DeleteObjectCommand({ Bucket: bucket, Key }))))
    s3.destroy()
  }
}
main().catch(error => {
  console.error('Storage verification failed:', error.name, error.$metadata?.httpStatusCode ?? '', error.name === 'AssertionError' ? error.message : '')
  process.exitCode = 1
})
