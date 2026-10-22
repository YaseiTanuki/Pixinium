import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { neon } from '@neondatabase/serverless'
import { results } from '../lib/archive'

async function main() {
  const connectionString = process.env.DATABASE_URL_UNPOOLED
  if (!connectionString) {
    throw new Error('DATABASE_URL_UNPOOLED is required to set up the archive database.')
  }

  const sql = neon(connectionString)
  const migration = await readFile(resolve(process.cwd(), 'db/migrations/0001_archive_items.sql'), 'utf8')
  await sql.query(migration)

  for (const [sortOrder, item] of results.entries()) {
    await sql.query(
      `INSERT INTO archive_items (title, category, meta, image, crop, color, accent, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (title) DO UPDATE SET
         category = EXCLUDED.category,
         meta = EXCLUDED.meta,
         image = EXCLUDED.image,
         crop = EXCLUDED.crop,
         color = EXCLUDED.color,
         accent = EXCLUDED.accent,
         sort_order = EXCLUDED.sort_order`,
      [item.title, item.category, item.meta, item.image ?? null, item.crop ?? null, item.color, item.accent ?? null, sortOrder],
    )
  }

  console.log(`Set up archive_items and seeded ${results.length} items.`)
}

main().catch((error: unknown) => {
  console.error('Failed to set up the archive database:', error)
  process.exitCode = 1
})
