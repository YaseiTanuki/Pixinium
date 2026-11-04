import { ASSET_PACK_LIMITS, CONTENT_LIMITS } from '@/lib/admin/limits'
import { agentCall } from '@/server/services/agent-store'
import { agentEndpoint, agentJson } from '@/server/services/agent-api'
import { fileTypes, MAX_CONTENT_FILE_BYTES } from '@/lib/admin/content'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  return agentEndpoint(request, 'catalog:read', async actor => {
    const { categories, tags } = await agentCall<{ categories: unknown[]; tags: unknown[] }>(actor, 'catalog')
    return agentJson({ categories, tags, fileTypes, limits: { maxFileBytes: MAX_CONTENT_FILE_BYTES, maxFiles: CONTENT_LIMITS.files,
      maxPackFiles: ASSET_PACK_LIMITS.images + 1, maxPackImages: ASSET_PACK_LIMITS.images, maxPackPreviews: ASSET_PACK_LIMITS.previews },
      rules: { workflow: 'All agent submissions are saved as private drafts. Only a human admin can approve publication in Admin Studio.', images: 'Original images are downloads; the first image generates a thumbnail. Resolution and format are detected automatically; Creator is Pixinium. Manual image facts are ignored.',
        music: 'One artwork image and audio tracks. Artwork is thumbnail-only; audio metadata is automatic.',
        games: 'One artwork image and one ZIP package. Artwork is thumbnail-only.',
        assets: 'Exactly one image with role cover and one or more images with role download. Supply fileName for ZIP entry names. Cover is excluded from the generated ZIP; the first images generate page previews.' } })
  })
}
