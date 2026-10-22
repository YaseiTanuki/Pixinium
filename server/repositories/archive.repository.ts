import 'server-only'

import { neon } from '@neondatabase/serverless'
import { isArchiveCategory, type ArchiveItem } from '../../lib/archive'

function isCategory(value: unknown): value is ArchiveItem['category'] {
  return typeof value === 'string' && isArchiveCategory(value)
}

function parseArchiveItem(row: Record<string, unknown>): ArchiveItem {
  if (
    typeof row.title !== 'string' ||
    !isCategory(row.category) ||
    typeof row.meta !== 'string' ||
    (row.image !== null && typeof row.image !== 'string') ||
    (row.crop !== null && typeof row.crop !== 'string') ||
    typeof row.color !== 'string' ||
    (row.accent !== null && row.accent !== 'music')
  ) {
    throw new Error('Neon returned an invalid archive item row.')
  }

  return {
    title: row.title,
    category: row.category,
    meta: row.meta,
    ...(row.image ? { image: row.image } : {}),
    ...(row.crop ? { crop: row.crop } : {}),
    color: row.color,
    ...(row.accent ? { accent: row.accent } : {}),
  }
}

function getDatabase() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to load the archive.')
  }
  return neon(connectionString)
}

export async function findArchiveItems(
  filters: { category?: ArchiveItem['category']; query?: string } = {},
): Promise<ArchiveItem[]> {
  const sql = getDatabase()
  const rows: Record<string, unknown>[] = await sql.query(
    `SELECT title, category, meta, image, crop, color, accent
     FROM archive_items
     WHERE ($1::text IS NULL OR category = $1)
       AND ($2::text IS NULL OR title ILIKE $2 OR category ILIKE $2)
     ORDER BY sort_order, title`,
    [filters.category ?? null, filters.query ? `%${filters.query}%` : null],
  )

  return rows.map(parseArchiveItem)
}
