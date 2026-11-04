import { createHash, randomBytes, randomUUID } from 'node:crypto'

export const AGENT_SCOPES = ['catalog:read', 'uploads:write', 'content:create', 'content:publish'] as const
export type AgentScope = typeof AGENT_SCOPES[number]
export type AgentActor = {
  kind: 'agent'; id: string; keyId: string; tokenHash: string
  job?: { id: string; leaseToken: string; itemId: string }
}
export type ContentActor = { kind?: 'user'; id: string; role: string } | AgentActor

export function isAgentActor(actor: ContentActor): actor is AgentActor {
  return actor.kind === 'agent'
}

export function stagingOwner(actor: ContentActor) {
  return isAgentActor(actor) ? `agents/${actor.id}` : actor.id
}

export function parseAgentCredential(header: string | null) {
  const match = /^Bearer pxa_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_([A-Za-z0-9_-]{43})$/.exec(header ?? '')
  if (!match) return null
  return { keyId: match[1], tokenHash: createHash('sha256').update(match[2]).digest('hex') }
}

export function newAgentCredential() {
  const keyId = randomUUID()
  const secret = randomBytes(32).toString('base64url')
  return { keyId, token: `pxa_${keyId}_${secret}`, tokenHash: createHash('sha256').update(secret).digest('hex') }
}

/** Stable across JSON object-key order; arrays retain their semantic order. */
export function agentPayloadHash(value: unknown): string {
  const canonical = (input: unknown): unknown => Array.isArray(input) ? input.map(canonical)
    : input !== null && typeof input === 'object'
      ? Object.fromEntries(Object.keys(input).sort().map(key => [key, canonical((input as Record<string, unknown>)[key])]))
      : input
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
}
