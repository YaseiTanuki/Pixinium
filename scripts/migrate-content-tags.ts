import assert from 'node:assert/strict'
import { Pool, neonConfig } from '@neondatabase/serverless'
import { migrate, type MigrationConnection } from './migrations'

/** Dry-run and then apply using the normal checksum ledger, verifying data before each commit. */
async function main() {
  const connectionString = process.env.DATABASE_URL_UNPOOLED
  if (!connectionString || new URL(connectionString).hostname.includes('-pooler')) {
    throw new Error('A direct DATABASE_URL_UNPOOLED is required.')
  }
  neonConfig.webSocketConstructor = WebSocket
  const pool = new Pool({ connectionString })
  try {
    const connection = await pool.connect()
    try {
      const { rows: [state] } = await connection.query("SELECT to_regclass('catalog.item_uses') IS NOT NULL AS legacy")
      if (!state.legacy) {
        console.log('Legacy uses tables are already removed.')
        return
      }
      for (const dryRun of [true, false]) {
        let definitions: Array<{ slug: string }> = []
        let associations: Array<{ item_id: string; slug: string }> = []
        let existingTags: Array<{ id: string; slug: string; name: string }> = []
        const checked: MigrationConnection = {
          async query(text, values) {
            if (text === 'BEGIN') {
              await connection.query(text)
              await connection.query("SET LOCAL lock_timeout = '10s'")
              await connection.query('LOCK TABLE catalog.content_uses, catalog.item_uses, catalog.tags, catalog.item_tags IN ACCESS EXCLUSIVE MODE')
              definitions = (await connection.query('SELECT slug FROM catalog.content_uses ORDER BY slug')).rows
              associations = (await connection.query(`SELECT item_id::text, use_slug AS slug FROM catalog.item_uses
                UNION SELECT it.item_id::text, t.slug FROM catalog.item_tags it JOIN catalog.tags t ON t.id = it.tag_id`)).rows
              existingTags = (await connection.query('SELECT id::text, slug, name FROM catalog.tags')).rows
              return
            }
            if (text !== 'COMMIT') return connection.query(text, values)
            const { rows: [removed] } = await connection.query(`SELECT
              to_regclass('catalog.item_uses') IS NULL AND to_regclass('catalog.content_uses') IS NULL AS ok`)
            assert.equal(removed.ok, true, 'Legacy tables were not removed')
            const tags = (await connection.query('SELECT id::text, slug, name FROM catalog.tags')).rows
            const tagBySlug = new Map(tags.map(tag => [tag.slug, tag]))
            for (const tag of existingTags) assert.deepEqual(tagBySlug.get(tag.slug), tag, 'Existing tag changed')
            for (const use of definitions) assert.ok(tagBySlug.has(use.slug), 'A use definition was lost')
            const links = (await connection.query(`SELECT it.item_id::text, t.slug FROM catalog.item_tags it
              JOIN catalog.tags t ON t.id = it.tag_id`)).rows
            const keys = new Set(links.map(link => `${link.item_id}:${link.slug}`))
            for (const link of associations) assert.ok(keys.has(`${link.item_id}:${link.slug}`), 'An item association was lost')
            await connection.query(dryRun ? 'ROLLBACK' : 'COMMIT')
            console.log(`${dryRun ? 'Dry run rolled back' : 'Migration committed'}: ${definitions.length} use definitions and ${associations.length} unique associations preserved; ${existingTags.length} existing tags unchanged.`)
          },
        }
        console.log(`Migrations: ${(await migrate(checked)).join(', ')}`)
      }
    } finally { connection.release() }
  } finally { await pool.end() }
}

main().catch((error: unknown) => {
  console.error('Tag migration failed:', error instanceof Error ? error.message : 'Unknown error')
  process.exitCode = 1
})
