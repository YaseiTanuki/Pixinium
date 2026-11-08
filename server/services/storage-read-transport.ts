import type { S3Client } from '@aws-sdk/client-s3'
import { FetchHttpHandler } from '@smithy/fetch-http-handler'
import { S3RequestPresigner } from '@aws-sdk/s3-request-presigner'
import { setUploadTraceContext } from '../../lib/upload-tracing'
import { querySignatureSnapshot } from './storage-query-signature'

const oldSigningHeaders = new Set(['authorization', 'x-amz-date', 'x-amz-security-token', 'x-amz-content-sha256',
  'amz-sdk-invocation-id', 'amz-sdk-request', 'x-amz-user-agent'])

/** Keep read authorization in a short-lived query signature, generated and consumed on the server. */
export function usePresignedStorageReads(storage: S3Client, customFetch?: typeof fetch) {
  const reads = new FetchHttpHandler({ requestInit: () => ({ redirect: 'manual', cache: 'no-store' }), customFetch: async (input, init) => {
    const request = input as Request
    // Retain the before-fetch inputs without hashing every successful read.
    // Expensive diagnostic HMAC work is needed only for failed authorization.
    const beforeRequest = request.clone()
    const response = await (customFetch ?? fetch)(input, init)
    if (response.status === 403) {
      try {
        const credentials = await storage.config.credentials()
        const before = querySignatureSnapshot(beforeRequest, credentials)
        const snapshot = querySignatureSnapshot(request, credentials)
        if (!before) console.error(JSON.stringify({ event: 'storage.query_signature.check_failed', stage: 'before_fetch' }))
        if (snapshot) {
          setUploadTraceContext({
            'storage.signature.local_recalculation_matches': snapshot.signature_matches,
            'storage.signature.before_transport_hash': before?.canonical_request_hash,
            'storage.signature.credential_fingerprint': snapshot.credential_fingerprint,
          })
          console.error(JSON.stringify({ event: 'storage.query_signature.debug', status: 403, ...snapshot,
            before_fetch_signature_matches: before?.signature_matches,
            before_fetch_canonical_request_hash: before?.canonical_request_hash,
            signed_request_unchanged_after_fetch: before ? before.canonical_request_hash === snapshot.canonical_request_hash &&
              before.provided_signature_hash === snapshot.provided_signature_hash : undefined,
          }))
        } else {
          console.error(JSON.stringify({ event: 'storage.query_signature.check_failed', stage: 'after_fetch' }))
        }
      } catch {
        console.error(JSON.stringify({ event: 'storage.query_signature.check_failed', stage: 'after_fetch' }))
      }
    }
    return response
  } })
  const presigner = new S3RequestPresigner(storage.config)
  const handler = storage.config.requestHandler
  const handle = handler.handle.bind(handler)
  handler.handle = async (request, ...args) => {
    const isRead = request.method === 'GET' || request.method === 'HEAD'
    setUploadTraceContext({ 'storage.transport': isRead ? 'fetch' : 'sdk_default' })
    if (!isRead) return handle(request, ...args)
    // Mirror the SDK's presign interceptor: telemetry headers are not part of
    // the presigned request. Remove the previous header signature from a clone.
    const headers = Object.fromEntries(Object.entries(request.headers).filter(([name]) => !oldSigningHeaders.has(name.toLowerCase())))
    const signed = await presigner.presign({ ...request, headers, query: { ...request.query } }, { expiresIn: 30 })
    setUploadTraceContext({ 'storage.auth_mode': 'presigned_query', 'storage.presigned_ttl': 30,
      'storage.signed_headers': signed.query?.['X-Amz-SignedHeaders'] })
    const result = await reads.handle(Object.assign(request.clone(), signed), ...args)
    // Workers supports manual/follow only. Reject redirects before the SDK can
    // retry them or forward the signed query to another destination.
    if (result.response.statusCode >= 300 && result.response.statusCode < 400) {
      await result.response.body?.cancel?.()
      throw new Error('Storage read redirects are not allowed.')
    }
    return result
  }
}
