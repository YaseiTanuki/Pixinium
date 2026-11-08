import 'server-only'
import { parseAgentCredential, type AgentActor, type AgentScope } from '@/lib/agent-identity'
import { authenticateAgent, agentError } from './agent-store'
import { setUploadTraceContext } from '@/lib/upload-tracing'

export class AgentApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export function agentJson(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store',
    ...(status === 401 ? { 'WWW-Authenticate': 'Bearer' } : {}) } })
}

export async function agentEndpoint(request: Request, scope: AgentScope, handler: (actor: AgentActor) => Promise<Response>) {
  setUploadTraceContext({ 'upload.scope': scope })
  try {
    if (!process.env.AGENT_DATABASE_URL) {
      throw new AgentApiError(503, 'Agent API is not configured.')
    }
    const credential = parseAgentCredential(request.headers.get('authorization'))
    if (!credential) throw new AgentApiError(401, 'Invalid bearer token.')
    const actor = await authenticateAgent(credential, scope)
    setUploadTraceContext({ 'agent.id': actor.id })
    const response = await handler(actor)
    setUploadTraceContext({ 'upload.response_status': response.status })
    return response
  } catch (error) {
    const failure = error instanceof AgentApiError ? { status: error.status, message: error.message } : agentError(error)
    setUploadTraceContext({ 'upload.response_status': failure.status })
    const response = agentJson({ error: failure.message }, failure.status)
    return response
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
