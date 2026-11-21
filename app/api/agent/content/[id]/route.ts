import { revalidatePath } from 'next/cache'
import { agentEndpoint, agentJson, readAgentJson, AgentApiError } from '@/server/services/agent-api'
import { agentCall } from '@/server/services/agent-store'
import { agentPayloadHash } from '@/lib/agent-identity'
import { agentDraftUpdate, agentItemId } from '@/lib/agent-drafts'

type Context = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Context) {
  return agentEndpoint(request, 'content:edit', async actor => {
    const { id } = await params
    if (!agentItemId.safeParse(id).success) throw new AgentApiError(422, 'Invalid item ID.')
    return agentJson(await agentCall(actor, 'draft', [id]))
  })
}

export async function PATCH(request: Request, { params }: Context) {
  return agentEndpoint(request, 'content:edit', async actor => {
    const { id } = await params
    if (!agentItemId.safeParse(id).success) throw new AgentApiError(422, 'Invalid item ID.')
    const parsed = agentDraftUpdate.safeParse(await readAgentJson(request))
    if (!parsed.success) throw new AgentApiError(422, parsed.error.issues[0]?.message ?? 'Invalid draft changes.')
    const key = request.headers.get('idempotency-key')
    if (!key || !/^[A-Za-z0-9._:-]{1,128}$/.test(key)) throw new AgentApiError(400, 'Provide a stable Idempotency-Key (1–128 letters, digits, dots, colons, underscores or hyphens).')
    const value = await agentCall(actor, 'update_draft', [id, key, agentPayloadHash({ id, ...parsed.data }), parsed.data.expectedUpdatedAt, parsed.data.changes])
    revalidatePath('/admin')
    revalidatePath(`/admin/${id}/edit`)
    return agentJson(value)
  })
}
