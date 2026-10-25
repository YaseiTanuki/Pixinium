import 'server-only'
import { neon } from '@neondatabase/serverless'
import { verifyAgentToken } from '@/lib/auth/agent-token'
import type { ContentActor } from './content-upload.service'

export class AgentApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export function agentJson(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store',
    ...(status === 401 ? { 'WWW-Authenticate': 'Bearer' } : {}) } })
}

export async function agentEndpoint(request: Request, handler: (actor: ContentActor) => Promise<Response>) {
  try {
    const hash = process.env.AGENT_API_TOKEN_SHA256
    const id = process.env.AGENT_API_ADMIN_ID
    if (!hash || !id || !/^[0-9a-f-]{36}$/i.test(id) || !process.env.CATALOG_ADMIN_DATABASE_URL) {
      throw new AgentApiError(503, 'Agent API is not configured.')
    }
    if (!verifyAgentToken(request.headers.get('authorization'), hash)) throw new AgentApiError(401, 'Invalid bearer token.')
    const sql = neon(process.env.CATALOG_ADMIN_DATABASE_URL)
    const [profile] = await sql`SELECT id::text, role FROM catalog.profiles WHERE id=${id}::uuid`
    if (!profile || profile.role !== 'admin') throw new AgentApiError(403, 'The agent account must be an active catalog admin.')
    return await handler({ id: String(profile.id), role: String(profile.role) })
  } catch (error) {
    return agentJson({ error: error instanceof AgentApiError ? error.message : 'Agent request failed.' },
      error instanceof AgentApiError ? error.status : 500)
  }
}

/** Bound actual bytes, including requests without Content-Length. Binary files go directly to storage. */
export async function readAgentJson(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') throw new AgentApiError(415, 'Use application/json.')
  if (!request.body) throw new AgentApiError(400, 'A JSON body is required.')
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 65536) {
        await reader.cancel()
        throw new AgentApiError(413, 'JSON body exceeds 64 KiB.')
      }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw new AgentApiError(400, 'Invalid JSON body.') }
}
