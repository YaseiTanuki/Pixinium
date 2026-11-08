import 'server-only'
import { createDatabase } from '@/lib/database'
import type { AgentActor, AgentScope } from '@/lib/agent-identity'

export function agentDatabase() {
  const connection = process.env.AGENT_DATABASE_URL
  if (!connection) throw Object.assign(new Error('Agent API unavailable'), { code: 'P0503' })
  return createDatabase(connection)
}

// Function names are an application allowlist, never interpolated from a request.
const functions = ['authenticate', 'catalog', 'category', 'reserve_upload', 'discard_uploads', 'start_job',
  'claim_uploads', 'content_slugs', 'job_state', 'fail_job', 'publish_job'] as const
export async function agentCall<T>(actor: Pick<AgentActor, 'keyId' | 'tokenHash'>,
  name: typeof functions[number], args: unknown[] = []): Promise<T> {
  if (!functions.includes(name)) throw new Error('Unknown agent operation')
  const params = [actor.keyId, actor.tokenHash, ...args]
  const [row] = await agentDatabase().query(`SELECT automation.${name}(${params.map((_, index) => `$${index + 1}`).join(',')}) AS value`, params)
  return row.value as T
}

export async function authenticateAgent(credential: Pick<AgentActor, 'keyId' | 'tokenHash'>, scope: AgentScope): Promise<AgentActor> {
  const [role] = await agentDatabase().query('SELECT rolsuper,rolbypassrls,rolcreaterole,rolcreatedb FROM pg_roles WHERE rolname=current_user')
  if (!role || role.rolsuper || role.rolbypassrls || role.rolcreaterole || role.rolcreatedb) {
    throw Object.assign(new Error('Agent runtime must use restricted credentials'), { code: 'P0503' })
  }
  const principal = await agentCall<{ id: string; keyId: string }>(credential, 'authenticate', [scope])
  return { kind: 'agent', ...principal, tokenHash: credential.tokenHash }
}

export function agentError(error: unknown): { status: number; message: string } {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
  const errors: Record<string, { status: number; message: string }> = {
    P0401: { status: 401, message: 'Invalid, expired or revoked agent key.' },
    P0403: { status: 403, message: 'This agent does not have permission for that operation or resource.' },
    P0409: { status: 409, message: 'The job is already running, the idempotency key conflicts, or its lease has expired.' },
    P0422: { status: 422, message: 'Invalid agent operation input.' },
    P0429: { status: 429, message: 'Agent request, upload or job quota exceeded. Try again after the quota window resets.' },
    P0503: { status: 503, message: 'Agent API is not configured.' },
  }
  return typeof code === 'string' && Object.hasOwn(errors, code) ? errors[code]
    : { status: 500, message: 'Agent request failed.' }
}
