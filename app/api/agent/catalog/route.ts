import { ASSET_PACK_LIMITS, CONTENT_LIMITS } from '@/lib/admin/limits'
import { agentCall } from '@/server/services/agent-store'
import { agentEndpoint, agentJson } from '@/server/services/agent-api'
import { fileTypes, MAX_CONTENT_FILE_BYTES } from '@/lib/admin/content'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  return agentEndpoint(request, 'catalog:read', async actor => {
    const { categories, tags, downloadSources } = await agentCall<{ categories: unknown[]; tags: unknown[]; downloadSources: unknown[] }>(actor, 'catalog')
    return agentJson({ categories, tags, downloadSources, fileTypes, limits: { maxFileBytes: MAX_CONTENT_FILE_BYTES, maxFiles: CONTENT_LIMITS.files,
      maxPackFiles: ASSET_PACK_LIMITS.files + ASSET_PACK_LIMITS.previews + 1, maxPackZips: ASSET_PACK_LIMITS.files, maxPackPreviews: ASSET_PACK_LIMITS.previews },
      rules: { workflow: 'All agent submissions are saved as private drafts. Only a human admin can approve publication in Admin Studio.', images: 'Original images are downloads; the first image generates a thumbnail. Resolution and format are detected automatically; Creator is Pixinium. Manual image facts are ignored.',
        music: 'One artwork image and audio tracks. Artwork is thumbnail-only; audio metadata is automatic.',
        games: 'One artwork image and one SWF or ZIP. SWF originals are playable with the play-able tag and are wrapped in ZIP on download. Uploaded ZIPs are download only. Artwork is thumbnail-only.',
        assets: 'Exactly one image with role cover, one ZIP file with role download, and up to 5 optional images with role preview. The uploaded ZIP is preserved unchanged. Cover and preview uploads are for display only and are not added to the ZIP. Send metadata: {}.' } })
  })
}
