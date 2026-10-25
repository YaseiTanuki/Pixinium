import { agentEndpoint, agentJson, readAgentJson, AgentApiError } from '@/server/services/agent-api'
import { createContentForActor } from '@/server/services/content-upload.service'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: Request) {
  return agentEndpoint(request, async actor => {
    const input = await readAgentJson(request)
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AgentApiError(400, 'Expected a content object.')
    const result = await createContentForActor(actor, {
      status: 'draft', summary: '', description: '', accentColor: '#f1e5dd', isFeatured: false,
      sortOrder: 0, metadata: {}, uses: [], tags: [], facts: [], attachments: [], ...input,
    })
    return agentJson(result, result.error ? 422 : 201)
  })
}
