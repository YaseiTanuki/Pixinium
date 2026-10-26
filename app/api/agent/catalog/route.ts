import { neon } from '@neondatabase/serverless'
import { agentEndpoint, agentJson } from '@/server/services/agent-api'
import { fileTypes, MAX_CONTENT_FILE_BYTES } from '@/lib/admin/content'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  return agentEndpoint(request, async () => {
    const sql = neon(process.env.CATALOG_ADMIN_DATABASE_URL!)
    const [categories, uses] = await Promise.all([
      sql`SELECT id::text,slug,name,metadata_schema_key AS "metadataSchemaKey" FROM catalog.categories WHERE is_active ORDER BY sort_order,id`,
      sql`SELECT slug,name FROM catalog.content_uses ORDER BY sort_order,slug`,
    ])
    return agentJson({ categories, uses, fileTypes, limits: { maxFileBytes: MAX_CONTENT_FILE_BYTES, maxFiles: 12 },
      rules: { images: 'Original images are downloads; the first image generates a thumbnail. Resolution and format are detected automatically; Creator is Pixinium. Manual image facts are ignored.',
        music: 'One artwork image and audio tracks. Artwork is thumbnail-only; audio metadata is automatic.',
        games: 'One artwork image and one ZIP package. Artwork is thumbnail-only.' } })
  })
}
