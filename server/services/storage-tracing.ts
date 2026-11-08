import { createHash } from 'node:crypto'
import type { S3Client } from '@aws-sdk/client-s3'
import { contentCreateDiagnostic } from '../../lib/content-diagnostics'
import { setUploadTraceContext } from '../../lib/upload-tracing'

/** Inspect only header names, generated object identity and safe response metadata. */
export function addStorageTracing(storage: S3Client, trace = setUploadTraceContext) {
  storage.middlewareStack.add((next, context) => async args => {
    const input = args.input as { Key?: string }
    const request = args.request as { headers?: Record<string, string> }
    const headers = request.headers ?? {}
    const signedHeaders = /(?:^|[, ])SignedHeaders=([a-z0-9;-]+)(?:,|$)/.exec(headers.authorization ?? '')?.[1]
    const ifMatch = headers['if-match']
    const objectId = input.Key ? createHash('sha256').update(input.Key).digest('hex').slice(0, 16) : undefined
    trace({
      'storage.operation': context.commandName,
      'storage.area': input.Key ? input.Key.startsWith('staging/') ? 'staging' : 'content' : 'bucket',
      'storage.object_id': objectId,
      'storage.if_match': Boolean(ifMatch),
      'storage.if_match_quoted': Boolean(ifMatch?.startsWith('"') && ifMatch.endsWith('"')),
      'storage.signed_headers': signedHeaders,
    })
    try {
      const result = await next(args)
      const metadata = (result.output as { $metadata?: { httpStatusCode?: number; requestId?: string } } | undefined)?.$metadata
      trace({ 'storage.response_status': metadata?.httpStatusCode,
        'storage.request_id': safeRequestId(metadata?.requestId) })
      return result
    } catch (error) {
      const diagnostic = contentCreateDiagnostic(error, 'finalize_files')
      const metadata = error && typeof error === 'object' && '$metadata' in error
        ? error.$metadata as { requestId?: string } | undefined : undefined
      trace({ 'storage.response_status': diagnostic.status,
        'storage.failed_operation': context.commandName, 'storage.failed_object_id': objectId,
        'storage.request_id': safeRequestId(metadata?.requestId),
        'upload.error.provider': diagnostic.providerError ?? diagnostic.code })
      throw error
    }
  }, { step: 'finalizeRequest', priority: 'low', name: 'pixiniumStorageTracing' })
}

function safeRequestId(value: unknown) {
  return typeof value === 'string' && /^[A-Za-z0-9_./:-]{1,200}$/.test(value) ? value : undefined
}
