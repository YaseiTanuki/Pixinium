import { agentEndpoint, agentJson, readAgentJson, AgentApiError } from '@/server/services/agent-api'
import { createContentForActor } from '@/server/services/content-upload.service'
import { contentSchema } from '@/lib/admin/content'
import { agentPayloadHash } from '@/lib/agent-identity'
import { agentCall } from '@/server/services/agent-store'
import { authDiagnostic } from '@/lib/auth/errors'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: Request) {
  return agentEndpoint(request, 'content:create', async actor => {
    const input = await readAgentJson(request)
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AgentApiError(400, 'Expected a content object.')
    const parsed = contentSchema.safeParse({
      summary: '', description: '', accentColor: '#f1e5dd', isFeatured: false,
      sortOrder: 0, metadata: {}, tags: [], facts: [], attachments: [], ...input, status: 'draft',
    })
    if (!parsed.success) throw new AgentApiError(422, parsed.error.issues[0]?.message ?? 'Invalid content.')
    const requestKey = request.headers.get('idempotency-key')
    if (!requestKey || !/^[A-Za-z0-9._:-]{1,128}$/.test(requestKey)) throw new AgentApiError(400, 'Provide an Idempotency-Key of 1–128 letters, digits, dots, colons, underscores or hyphens.')
    // Keep request hashes stable for existing clients/checkpoints. Requested status
    // affects idempotency only; the handler, service and broker still write drafts.
    const requestedStatus = (input as Record<string, unknown>).status === 'draft' ? 'draft' : 'published'
    const reservation = await agentCall<{ state: string; result?: unknown; id?: string; leaseToken?: string; itemId?: string }>(actor,
      'start_job', [requestKey, agentPayloadHash({ ...parsed.data, status: requestedStatus }), parsed.data.categoryId])
    if (reservation.state === 'succeeded') {
      const response = agentJson(reservation.result, 201)
      response.headers.set('Idempotency-Replayed', 'true')
      return response
    }
    if (reservation.state === 'processing') {
      const response = agentJson({ message: 'This job is already processing. Retry the same request and key.' }, 202)
      response.headers.set('Retry-After', '5')
      return response
    }
    const job = { id: reservation.id!, leaseToken: reservation.leaseToken!, itemId: reservation.itemId! }
    let failed = true
    try {
      const result = await createContentForActor({ ...actor, job }, parsed.data, 'agent')
      failed = Boolean(result.error)
      return agentJson(result, result.error ? 422 : 201)
    } finally {
      if (failed) {
        try { await agentCall(actor, 'fail_job', [job.id, job.leaseToken]) }
        catch (error) { console.error('[agent.job.cleanup]', authDiagnostic(error)) }
      }
    }
  })
}
