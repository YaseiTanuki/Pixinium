import 'server-only'
import { neon } from '@neondatabase/serverless'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { MAX_STORY_CHAPTER_BYTES } from '@/lib/story-chapters'
import { hasPermission } from '@/lib/auth/permissions'
import type { ContentResult } from '@/lib/admin/content'
import type { ContentActor } from '@/server/services/content-upload.service'

const chapterSchema = z.object({
  itemId: z.string().regex(/^[1-9][0-9]{0,18}$/),
  chapterNumber: z.number().int().min(1).max(100_000),
  contentMarkdown: z.string().min(1).max(MAX_STORY_CHAPTER_BYTES),
})

export async function addStoryChapterForActor(account: ContentActor | null, input: unknown): Promise<ContentResult> {
  if (!account || !hasPermission(account.role, 'assets:upload')) return { error: 'Upload access is required.' }
  const parsed = chapterSchema.safeParse(input)
  if (!parsed.success) return { error: 'Check the chapter number and Markdown file.' }
  const { itemId, chapterNumber, contentMarkdown } = parsed.data
  if (!contentMarkdown.trim() || contentMarkdown.includes('\0') ||
      new TextEncoder().encode(contentMarkdown).byteLength > MAX_STORY_CHAPTER_BYTES) {
    return { error: 'Choose a non-empty UTF-8 Markdown file up to 512 KB.' }
  }
  const connection = process.env.CATALOG_ADMIN_DATABASE_URL
  if (!connection) return { error: 'Content writing is not configured. Set the server-side catalog admin connection.' }

  const sql = neon(connection)
  const rows = await sql`
    WITH eligible AS MATERIALIZED (
      SELECT i.id, i.slug, c.slug AS category_slug
      FROM catalog.items i
      JOIN catalog.categories c ON c.id = i.category_id
      JOIN catalog.profiles p ON p.id = ${account.id}::uuid AND p.role = 'admin'
      WHERE i.id = ${itemId}::bigint AND i.status = 'published'
        AND c.is_active AND c.metadata_schema_key = 'stories.v1'
    ), inserted AS (
      INSERT INTO catalog.story_chapters(item_id, chapter_number, content_markdown)
      SELECT eligible.id, ${chapterNumber}, ${contentMarkdown} FROM eligible
      ON CONFLICT (item_id, chapter_number) DO NOTHING
      RETURNING item_id
    )
    SELECT eligible.slug, eligible.category_slug,
      EXISTS (SELECT 1 FROM inserted) AS inserted
    FROM eligible`
  if (!rows[0]) return { error: 'The story was not found or chapter upload is not allowed.' }
  if (!rows[0].inserted) return { error: `Chapter ${chapterNumber} already exists. Choose another chapter number.` }

  revalidatePath('/admin')
  revalidatePath(`/${rows[0].category_slug}`)
  revalidatePath(`/items/${rows[0].category_slug}/${rows[0].slug}`)
  return { message: `Chapter ${chapterNumber} added.` }
}
