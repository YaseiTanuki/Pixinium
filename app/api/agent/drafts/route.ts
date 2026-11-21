import { agentEndpoint, agentJson, AgentApiError } from '@/server/services/agent-api'
import { agentCall } from '@/server/services/agent-store'
import { agentItemId } from '@/lib/agent-drafts'

export async function GET(request: Request) {
  return agentEndpoint(request, 'content:edit', async actor => {
    const cursor = new URL(request.url).searchParams.get('before')
    if (cursor !== null && !agentItemId.safeParse(cursor).success) throw new AgentApiError(422, 'Invalid draft cursor.')
    return agentJson(await agentCall(actor, 'drafts', [cursor]))
  })
}
