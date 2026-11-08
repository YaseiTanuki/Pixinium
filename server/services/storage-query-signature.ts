import { createHash, createHmac } from 'node:crypto'

const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const escape = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g,
  character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)

/** Independently verify the Fetch Request's SigV4 without returning credentials, URLs or signatures. */
export function querySignatureSnapshot(request: Request, credentials: {
  accessKeyId: string; secretAccessKey: string; sessionToken?: string
}) {
  const url = new URL(request.url)
  const query = url.searchParams
  const credential = (query.get('X-Amz-Credential') ?? '').split('/')
  const signature = query.get('X-Amz-Signature') ?? ''
  const date = query.get('X-Amz-Date') ?? ''
  const signedNames = query.get('X-Amz-SignedHeaders') ?? ''
  if (!['GET', 'HEAD'].includes(request.method) || credential.length !== 5 || credential[4] !== 'aws4_request' ||
    !/^[a-f0-9]{64}$/.test(signature) || !/^\d{8}T\d{6}Z$/.test(date) ||
    !/^[a-z0-9-]+(?:;[a-z0-9-]+)*$/.test(signedNames)) return undefined
  const headerValues = Object.fromEntries(signedNames.split(';').map(name => [name,
    (name === 'host' ? url.host : request.headers.get(name) ?? '').trim().replace(/\s+/g, ' ')]))
  const canonicalHeaders = Object.entries(headerValues).map(([name, value]) => `${name}:${value}\n`).join('')
  const canonicalQuery = [...query.entries()].filter(([name]) => name !== 'X-Amz-Signature')
    .map(([name, value]) => [escape(name), escape(value)])
    .sort(([a, av], [b, bv]) => a < b ? -1 : a > b ? 1 : av < bv ? -1 : av > bv ? 1 : 0)
    .map(([name, value]) => `${name}=${value}`).join('&')
  const canonical = [request.method, url.pathname, canonicalQuery, canonicalHeaders, signedNames, 'UNSIGNED-PAYLOAD'].join('\n')
  const scope = credential.slice(1).join('/')
  const stringToSign = ['AWS4-HMAC-SHA256', date, scope, hash(canonical)].join('\n')
  let key = Buffer.from(`AWS4${credentials.secretAccessKey}`)
  for (const part of credential.slice(1)) key = createHmac('sha256', key).update(part).digest()
  const expected = createHmac('sha256', key).update(stringToSign).digest('hex')
  return {
    method: request.method, host: url.host, signing_date: date, credential_scope: scope,
    expires_in: query.get('X-Amz-Expires'), signed_headers: signedNames,
    query_parameter_names: [...query.keys()].sort(),
    signed_header_hashes: Object.fromEntries(Object.entries(headerValues).map(([name, value]) => [name, hash(value)])),
    path_hash: hash(url.pathname), canonical_request_hash: hash(canonical),
    provided_signature_hash: hash(signature), expected_signature_hash: hash(expected),
    signature_matches: expected === signature, credential_id_matches: credential[0] === credentials.accessKeyId,
    credential_fingerprint: hash(JSON.stringify([credentials.accessKeyId, credentials.secretAccessKey, credentials.sessionToken ?? ''])),
  }
}
