import type { S3Client } from '@aws-sdk/client-s3'
import { FetchHttpHandler } from '@smithy/fetch-http-handler'
import { setUploadTraceContext } from '../../lib/upload-tracing'

/** Send signed reads through fetch without the Workers node:http compatibility layer. */
export function useFetchForStorageReads(storage: S3Client, reads = new FetchHttpHandler()) {
  const handler = storage.config.requestHandler
  const handle = handler.handle.bind(handler)
  handler.handle = (request, ...args) => {
    const isRead = request.method === 'GET' || request.method === 'HEAD'
    setUploadTraceContext({ 'storage.transport': isRead ? 'fetch' : 'sdk_default' })
    return isRead ? reads.handle(request, ...args) : handle(request, ...args)
  }
}
