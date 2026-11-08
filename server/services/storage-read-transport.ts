import type { S3Client } from '@aws-sdk/client-s3'
import { FetchHttpHandler } from '@smithy/fetch-http-handler'
import { S3RequestPresigner } from '@aws-sdk/s3-request-presigner'
import { setUploadTraceContext } from '../../lib/upload-tracing'

const oldSigningHeaders = new Set(['authorization', 'x-amz-date', 'x-amz-security-token', 'x-amz-content-sha256',
  'amz-sdk-invocation-id', 'amz-sdk-request', 'x-amz-user-agent'])

/** Keep read authorization in a short-lived query signature, generated and consumed on the server. */
export function usePresignedStorageReads(storage: S3Client, customFetch?: typeof fetch) {
  const reads = new FetchHttpHandler({ customFetch, requestInit: () => ({ redirect: 'error' }) })
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
    return reads.handle(Object.assign(request.clone(), signed), ...args)
  }
}
