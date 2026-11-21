import { agentEndpoint, AgentApiError } from '@/server/services/agent-api'
import { agentCall } from '@/server/services/agent-store'
import { agentItemId } from '@/lib/agent-drafts'
import { adminStorage, inspectStoredFile, readStoredBytes } from '@/server/services/storage.service'
import { createImageThumbnail } from '@/server/services/image-thumbnail'
import { MAX_CONTENT_FILE_BYTES } from '@/lib/admin/limits'

/** Return image bytes directly: no public or signed storage URL leaves the server. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return agentEndpoint(request, 'content:edit', async actor => {
    const { id } = await params
    const assetId = new URL(request.url).searchParams.get('assetId')
    if (!agentItemId.safeParse(id).success || (assetId !== null && !agentItemId.safeParse(assetId).success)) {
      throw new AgentApiError(422, 'Invalid draft or image ID.')
    }
    const image = await agentCall<{ assetId: string; bucket: string; path: string }>(actor, 'draft_image', [id, assetId])
    if (image.bucket !== adminStorage().bucket) throw new AgentApiError(403, 'Draft image is unavailable.')
    const stored = await inspectStoredFile(image.path)
    const size = stored.ContentLength
    if (!size || size > MAX_CONTENT_FILE_BYTES) throw new AgentApiError(413, 'Image exceeds the preview input limit.')
    const bytes = await readStoredBytes(image.path, size, stored.ETag)
    const preview = await createImageThumbnail(bytes)
    if (preview.data.byteLength > 2 * 1024 * 1024) throw new AgentApiError(413, 'Image preview exceeds 2 MiB.')
    return new Response(Uint8Array.from(preview.data), { headers: {
      'Content-Type': 'image/webp', 'Content-Length': String(preview.data.byteLength),
      'Cache-Control': 'private, no-store', Vary: 'Authorization',
      'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex', 'X-Content-Type-Options': 'nosniff',
      'X-Asset-Id': image.assetId, 'X-Preview-Width': String(preview.width), 'X-Preview-Height': String(preview.height),
    } })
  })
}
