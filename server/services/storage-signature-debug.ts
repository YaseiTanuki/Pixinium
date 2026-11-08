import { createHash } from 'node:crypto'
import type { S3Client } from '@aws-sdk/client-s3'
import { SignatureV4, getCanonicalHeaders, getCanonicalQuery } from '@smithy/signature-v4'
import { setUploadTraceContext } from '../../lib/upload-tracing'

type SignedRequest = Parameters<typeof getCanonicalHeaders>[0]
const digest = (value: string) => createHash('sha256').update(value).digest('hex')

class DiagnosticSigner extends SignatureV4 {
  canonical(request: SignedRequest, signed: Set<string>) {
    const excluded = new Set(Object.keys(request.headers).map(name => name.toLowerCase()).filter(name => !signed.has(name)))
    const headers = getCanonicalHeaders(request, excluded, signed)
    const payload = request.headers['x-amz-content-sha256'] ?? digest('')
    return { text: this.createCanonicalRequest(request, headers, payload), headers, excluded }
  }
}

/** Re-sign a clone with the same timestamp and header set. Never return raw credentials or signature inputs. */
export async function signatureSnapshot(storage: S3Client, request: SignedRequest) {
  const authorization = request.headers.authorization ?? ''
  const match = /^AWS4-HMAC-SHA256 Credential=([^/]+)\/(\d{8}\/([a-z0-9-]+)\/([a-z0-9-]+)\/aws4_request), SignedHeaders=([a-z0-9;-]+), Signature=([a-f0-9]{64})$/.exec(authorization)
  const date = request.headers['x-amz-date']
  if (!match || !date || !/^\d{8}T\d{6}Z$/.test(date) || !['GET', 'HEAD'].includes(request.method) || request.body != null) return undefined
  const [, accessKeyId, scope, region, service, signedNames, signature] = match
  const credentials = await storage.config.credentials()
  const signer = new DiagnosticSigner({ credentials, region, service, sha256: storage.config.sha256, uriEscapePath: false })
  const signed = new Set(signedNames.split(';'))
  const canonical = signer.canonical(request, signed)
  const canonicalHash = digest(canonical.text)
  const signingDate = new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${date.slice(9, 11)}:${date.slice(11, 13)}:${date.slice(13, 15)}Z`)
  const recalculated = await signer.sign(request, { signingDate, signableHeaders: signed, unsignableHeaders: canonical.excluded })
  const expectedSignature = /Signature=([a-f0-9]{64})$/.exec(recalculated.headers.authorization ?? '')?.[1]
  let endpointMatchesEnv: boolean | undefined
  try { endpointMatchesEnv = request.hostname === new URL(process.env.AWS_ENDPOINT_URL_S3!).hostname } catch { /* No configured endpoint. */ }
  return {
    method: request.method, host: request.hostname, credential_scope: scope, signing_date: date,
    canonical_request_hash: canonicalHash,
    string_to_sign_hash: digest(`AWS4-HMAC-SHA256\n${date}\n${scope}\n${canonicalHash}`),
    path_hash: digest(request.path), query_hash: digest(getCanonicalQuery(request)),
    signed_headers: signedNames,
    signed_header_hashes: Object.fromEntries(Object.entries(canonical.headers).map(([name, value]) => [name, digest(value)])),
    authorization_hash: digest(authorization),
    credential_fingerprint: digest(JSON.stringify([credentials.accessKeyId, credentials.secretAccessKey, credentials.sessionToken ?? ''])),
    has_session_token: Boolean(credentials.sessionToken),
    credential_id_matches_signer: credentials.accessKeyId === accessKeyId,
    credentials_match_env: credentials.accessKeyId === process.env.AWS_ACCESS_KEY_ID &&
      credentials.secretAccessKey === process.env.AWS_SECRET_ACCESS_KEY &&
      (credentials.sessionToken ?? '') === (process.env.AWS_SESSION_TOKEN ?? ''),
    region_matches_env: region === process.env.AWS_REGION, endpoint_matches_env: endpointMatchesEnv,
    signature_matches_local_recalculation: expectedSignature === signature,
  }
}

type Snapshot = Awaited<ReturnType<typeof signatureSnapshot>>
type RequestDebug = { signed?: Snapshot; transport?: Snapshot }

/** Temporary, opt-in diagnostics only for failed signed reads. The request is never altered. */
export function addStorageSignatureDebug(storage: S3Client, options: {
  enabled?: boolean; emit?: (event: Record<string, unknown>) => void
} = {}) {
  if (!(options.enabled ?? process.env.PIXINIUM_S3_SIGNATURE_DEBUG === 'true')) return
  const emit = options.emit ?? (event => console.error(JSON.stringify(event)))
  const states = new WeakMap<object, RequestDebug>()
  const snapshot = async (request: SignedRequest) => {
    try { return await signatureSnapshot(storage, request) } catch { return undefined }
  }
  const handler = storage.config.requestHandler
  const handle = handler.handle.bind(handler)
  handler.handle = async (request, ...args) => {
    const state = states.get(request)
    if (state) state.transport = await snapshot(request)
    return handle(request, ...args)
  }
  storage.middlewareStack.add((next, context) => async args => {
    if (!['HeadObjectCommand', 'GetObjectCommand'].includes(context.commandName ?? '')) return next(args)
    const request = args.request as SignedRequest
    const state: RequestDebug = { signed: await snapshot(request) }
    if (!state.signed) return next(args)
    states.set(request, state)
    try {
      return await next(args)
    } catch (error) {
      if (error && typeof error === 'object' && 'name' in error && error.name === 'SignatureDoesNotMatch') {
        try {
          const value = error as Record<string, unknown>
          const serverCanonicalHash = typeof value.CanonicalRequest === 'string' && value.CanonicalRequest.length <= 32768
            ? digest(value.CanonicalRequest) : undefined
          const serverStringHash = typeof value.StringToSign === 'string' && value.StringToSign.length <= 32768
            ? digest(value.StringToSign) : undefined
          const changedHeaders = state.transport ? [...new Set([
            ...Object.keys(state.signed!.signed_header_hashes), ...Object.keys(state.transport.signed_header_hashes),
          ])].filter(name => state.signed!.signed_header_hashes[name] !== state.transport!.signed_header_hashes[name]) : undefined
          const unchanged = state.transport ? state.signed!.canonical_request_hash === state.transport.canonical_request_hash : undefined
          setUploadTraceContext({ 'storage.signature.after_signing_hash': state.signed!.canonical_request_hash,
            'storage.signature.before_transport_hash': state.transport?.canonical_request_hash,
            'storage.signature.unchanged_before_transport': unchanged,
            'storage.signature.local_recalculation_matches': state.transport?.signature_matches_local_recalculation,
            'storage.signature.credential_fingerprint': state.signed!.credential_fingerprint })
          emit({ event: 'storage.signature.debug', operation: context.commandName,
            after_signing: state.signed, before_transport: state.transport,
            canonical_unchanged_before_transport: unchanged, changed_signed_headers: changedHeaders,
            server_canonical_request_hash: serverCanonicalHash, server_string_to_sign_hash: serverStringHash })
        } catch { /* Diagnostics must not replace the provider error. */ }
      }
      throw error
    } finally { states.delete(request) }
  }, { step: 'finalizeRequest', priority: 'low', name: 'pixiniumSignatureDebug' })
}
