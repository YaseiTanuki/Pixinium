import { agentEndpoint, agentJson, readAgentJson } from '@/server/services/agent-api'
import { prepareContentUploadForActor, discardContentUploadsForActor } from '@/server/services/content-upload.service'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  return agentEndpoint(request, async actor => {
    const result = await prepareContentUploadForActor(actor, await readAgentJson(request))
    return agentJson(result.error ? result : { ...result, method: 'PUT', expiresIn: 300,
      headers: { 'Content-Type': result.mime } }, result.error ? 422 : 201)
  })
}

export async function DELETE(request: Request) {
  return agentEndpoint(request, async actor => {
    const result = await discardContentUploadsForActor(actor, await readAgentJson(request))
    return agentJson(result, result.error ? 422 : 200)
  })
}
