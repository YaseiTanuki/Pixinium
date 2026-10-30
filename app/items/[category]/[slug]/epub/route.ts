import { neon } from '@neondatabase/serverless'
import { NextResponse } from 'next/server'
import { createStoryEpub, type EpubChapter } from '@/server/services/story-epub'
import { authDiagnostic } from '@/lib/auth/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ category: string; slug: string }> }) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }
  const { category, slug } = await params
  try {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to download story EPUB files.')
    const sql = neon(process.env.DATABASE_URL)
    const [story] = await sql`
      SELECT i.id::text, i.title, i.slug,
        (SELECT f.value FROM catalog.item_facts f WHERE f.item_id = i.id AND f.key = 'author' LIMIT 1) AS author
      FROM catalog.items i JOIN catalog.categories c ON c.id = i.category_id
      WHERE c.slug = ${category} AND i.slug = ${slug} AND i.status = 'published'
        AND c.is_active AND c.metadata_schema_key = 'stories.v1'`
    if (!story) return new NextResponse(null, { status: 404, headers })
    const chapters = await sql.query(`
      SELECT chapter_number AS "chapterNumber", content_markdown AS "contentMarkdown"
      FROM catalog.story_chapters WHERE item_id = $1::bigint ORDER BY chapter_number`, [story.id]) as EpubChapter[]
    if (!chapters.length) return NextResponse.json({ error: 'This story does not have any chapters yet.' }, { status: 404, headers })
    const epub = await createStoryEpub(String(story.title), chapters, typeof story.author === 'string' ? story.author : undefined)
    const filename = `${String(story.slug)}.epub`
    return new Response(epub, {
      headers: {
        ...headers,
        'Content-Type': 'application/epub+zip',
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(String(story.title))}.epub`,
        'Content-Length': String(epub.byteLength),
      },
    })
  } catch (error) {
    console.error('[stories.epub]', authDiagnostic(error))
    return NextResponse.json({ error: 'The EPUB could not be generated.' }, { status: 503, headers })
  }
}
