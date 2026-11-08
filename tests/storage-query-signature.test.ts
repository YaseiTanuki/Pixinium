import assert from 'node:assert/strict'
import test from 'node:test'
import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { querySignatureSnapshot } from '../server/services/storage-query-signature'

test('independent query verifier matches SDK signatures and detects changed method, path, range and credentials', async () => {
  const credentials = { accessKeyId: 'test-access', secretAccessKey: 'test-secret', sessionToken: 'test-session-secret' }
  const client = new S3Client({ region: 'ap-southeast-1', endpoint: 'https://storage.example.invalid', forcePathStyle: true, credentials })
  for (const Command of [HeadObjectCommand, GetObjectCommand]) {
    const isGet = Command === GetObjectCommand
    const url = await getSignedUrl(client, new Command({ Bucket: 'pixinium', Key: 'staging/space + unicode-é.png',
      ...(isGet ? { Range: 'bytes=0-0', IfMatch: '"original-etag"' } : {}) }), { expiresIn: 30 })
    const options: RequestInit = { method: isGet ? 'GET' : 'HEAD', headers: isGet ? { range: 'bytes=0-0', 'if-match': '"original-etag"' } : undefined }
    const snapshot = querySignatureSnapshot(new Request(url, options), credentials)!
    assert.equal(snapshot.signature_matches, true)
    assert.equal(snapshot.credential_id_matches, true)
    assert.equal(querySignatureSnapshot(new Request(url, { ...options, method: 'POST' }), credentials), undefined)
    assert.equal(querySignatureSnapshot(new Request(url, { ...options, method: isGet ? 'HEAD' : 'GET' }), credentials)!.signature_matches, false)
    const changed = new URL(url)
    changed.pathname += '-changed'
    assert.equal(querySignatureSnapshot(new Request(changed, options), credentials)!.signature_matches, false)
    assert.equal(querySignatureSnapshot(new Request(url, options), { ...credentials, secretAccessKey: 'wrong-secret' })!.signature_matches, false)
    if (isGet) assert.equal(querySignatureSnapshot(new Request(url, { ...options, headers: { range: 'bytes=1-1', 'if-match': '"original-etag"' } }), credentials)!.signature_matches, false)
    const serialized = JSON.stringify(snapshot)
    for (const secret of [credentials.accessKeyId, credentials.secretAccessKey, credentials.sessionToken,
      new URL(url).searchParams.get('X-Amz-Signature')!, 'original-etag', 'staging/space']) {
      assert.equal(serialized.includes(secret), false)
    }
  }
  client.destroy()
})
