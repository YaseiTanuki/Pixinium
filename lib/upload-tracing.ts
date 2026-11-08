import { getCloudflareContext } from '@opennextjs/cloudflare'

const attributeNames = new Set([
  'user.id', 'agent.id', 'agent.job.id', 'content.item.id', 'upload.scope', 'upload.stage',
  'upload.response_status', 'upload.error.provider', 'storage.operation', 'storage.area',
  'storage.object_id', 'storage.if_match', 'storage.if_match_quoted', 'storage.signed_headers',
  'storage.response_status', 'storage.request_id',
  'storage.transport',
  'storage.auth_mode', 'storage.presigned_ttl',
  'storage.failed_operation', 'storage.failed_object_id',
  'storage.signature.after_signing_hash', 'storage.signature.before_transport_hash',
  'storage.signature.unchanged_before_transport', 'storage.signature.local_recalculation_matches',
  'storage.signature.credential_fingerprint',
])

export interface UploadSpan {
  setAttribute(name: string, value: string | number | boolean): unknown
}

function activeUploadSpan(): UploadSpan | undefined {
  try {
    // ctx.tracing is the same API as cloudflare:workers tracing. Access through
    // OpenNext keeps this module importable by ordinary Node.js builds and tests.
    const ctx = getCloudflareContext().ctx as unknown as {
      tracing?: { getActiveSpan(): UploadSpan | undefined }
    }
    return ctx.tracing?.getActiveSpan()
  } catch {
    return undefined
  }
}

/** Explicit attributes only; tracing must never affect the upload's result. */
export function setUploadTraceContext(attributes: Record<string, unknown>, span = activeUploadSpan()) {
  if (!span) return
  try {
    for (const [name, value] of Object.entries(attributes)) {
      if (!attributeNames.has(name)) continue
      if ((typeof value === 'string' && value.length <= 256) || typeof value === 'boolean' ||
        (typeof value === 'number' && Number.isFinite(value))) span.setAttribute(name, value)
    }
  } catch { /* Observability is best effort. */ }
}
