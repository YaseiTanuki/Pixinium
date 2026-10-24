import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { migrate, type MigrationConnection } from '../scripts/migrations'
import { results } from './fixtures/legacy-archive'
import { parseCategoryMetadata } from '../lib/entities/metadata'
import { updateItemMetadata } from '../server/services/catalog-metadata'
import { cardsQuery } from '../server/repositories/catalog.queries'
import { itemHref } from '../lib/catalog'
import type { CatalogCard } from '../lib/entities/catalog'

const alice = '00000000-0000-4000-8000-000000000001'
const bob = '00000000-0000-4000-8000-000000000002'

function connection(db: PGlite): MigrationConnection {
  return { query: async (sql, values) => values ? db.query(sql, values) : (await db.exec(sql)).at(-1) }
}

async function seedLegacy(db: PGlite) {
  await db.exec(await readFile('db/migrations/0001_archive_items.sql', 'utf8'))
  for (const [index, item] of results.entries()) {
    await db.query(`INSERT INTO archive_items(title, category, meta, image, crop, color, accent, sort_order)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [item.title, item.category, item.meta, item.image ?? null, item.crop ?? null, item.color, item.accent ?? null, index])
  }
}

test('catalog migration, extensibility, and runtime authorization', async (t) => {
  const db = new PGlite()
  try {
    await seedLegacy(db)
    assert.deepEqual(await migrate(connection(db)), ['0001_archive_items.sql', '0002_catalog_entities.sql', '0003_catalog_profiles_and_validation.sql'])

    await t.test('application query returns canonical identities, facts and assets, and enforces visibility without RLS', async () => {
      const rows = (await db.query<CatalogCard & { assets: unknown[] }>(cardsQuery, [null, null, null])).rows
      assert.equal(rows.length, 8)
      assert.equal(rows[0].item.id, '1')
      assert.equal(rows[0].category.slug, 'wallpapers')
      assert.equal(rows[0].facts[0].label, 'Resolution')
      assert.equal(rows[0].assets.length, 1)
      assert.equal(itemHref(rows[0]), `/items/wallpapers/${rows[0].item.slug}`)
      assert.equal((await db.query(cardsQuery, ['music', rows[0].item.slug, null])).rows.length, 0)
      assert.equal((await db.query(cardsQuery, ['wallpapers', rows[0].item.slug, null])).rows.length, 1)
      await db.exec('BEGIN')
      try {
        await db.exec(`UPDATE catalog.items SET status = 'draft' WHERE id = 1`)
        assert.equal((await db.query(cardsQuery, ['wallpapers', rows[0].item.slug, null])).rows.length, 0)
        await db.exec(`UPDATE catalog.categories SET is_active = false WHERE slug = 'music'`)
        assert.equal((await db.query(cardsQuery, ['music', null, null])).rows.length, 0)
      } finally { await db.exec('ROLLBACK') }
      assert.equal((await db.query(cardsQuery, [null, null, '%werewolf%'])).rows.length, 1)
    })

    await t.test('backfill preserves the archive, splits facts, deduplicates assets, and preserves focal points', async () => {
      assert.equal((await db.query('SELECT * FROM archive_items')).rows.length, 8)
      assert.equal((await db.query('SELECT * FROM catalog.items')).rows.length, 8)
      assert.equal((await db.query('SELECT * FROM catalog.item_facts')).rows.length, 16)
      assert.equal((await db.query('SELECT * FROM catalog.assets')).rows.length, 1)
      assert.equal((await db.query('SELECT * FROM catalog.item_assets')).rows.length, 5)
      const cover = (await db.query<{ focal_x: string; focal_y: string }>(`SELECT focal_x, focal_y FROM catalog.item_assets ia
        JOIN catalog.legacy_item_keys k ON k.item_id = ia.item_id WHERE legacy_title = 'Exploding Werewolf'`)).rows[0]
      assert.equal(Number(cover.focal_x), 10)
      assert.equal(Number(cover.focal_y), 18)
      const accent = (await db.query<{ accent_color: string }>('SELECT accent_color FROM catalog.items WHERE id = 1')).rows[0]
      assert.equal(accent.accent_color, '#f1e5dd')
      assert.deepEqual(await migrate(connection(db)), [])
    })

    await t.test('new categories need only rows; rename does not break references or legacy links', async () => {
      await db.exec(`INSERT INTO catalog.categories(slug, name) VALUES ('fonts', 'Fonts');
        INSERT INTO catalog.items(category_id, slug, title, status, published_at)
        SELECT id, 'soft-serif', 'Soft Serif', 'published', now() FROM catalog.categories WHERE slug = 'fonts';
        INSERT INTO catalog.item_facts(item_id, key, label, value)
        SELECT id, 'weights', 'Weights', '6 weights' FROM catalog.items WHERE slug = 'soft-serif';
        UPDATE catalog.items SET title = 'Werewolf, renamed' WHERE id = 1;`)
      assert.equal((await db.query(`SELECT * FROM catalog.legacy_item_keys WHERE legacy_title = 'Exploding Werewolf' AND item_id = 1`)).rows.length, 1)
      assert.equal((await db.query(`SELECT * FROM catalog.item_facts WHERE key = 'weights'`)).rows.length, 1)
      await assert.rejects(db.exec(`DELETE FROM catalog.categories WHERE slug = 'fonts'`), /foreign key/)
    })

    await t.test('constraints reject ambiguous asset locations, duplicate covers, and invalid facts', async () => {
      await assert.rejects(db.exec(`INSERT INTO catalog.assets(provider) VALUES ('supabase')`), /check constraint/)
      await assert.rejects(db.exec(`INSERT INTO catalog.assets(provider, external_url) VALUES ('external', 'javascript:alert(1)')`), /check constraint/)
      await assert.rejects(db.exec(`INSERT INTO catalog.item_assets(item_id, asset_id, role) VALUES (1, 1, 'cover')`), /unique constraint/)
      await assert.rejects(db.exec(`INSERT INTO catalog.item_facts(item_id, key, label, value) VALUES (1, 'empty', 'Empty', '')`), /check constraint/)
      await assert.rejects(db.exec(`INSERT INTO catalog.items(category_id, slug, title, status) VALUES (1, 'no-date', 'No date', 'published')`), /check constraint/)
      await db.exec(`INSERT INTO catalog.assets(provider, bucket, object_path, media_type)
        VALUES ('supabase', 'archive', 'fonts/soft-serif.zip', 'file')`)
    })

    await t.test('slugs are unique within a category; storage paths are unique within a provider', async () => {
      await db.exec(`INSERT INTO catalog.items(category_id, slug, title) VALUES (1, 'shared-slug', 'First'), (2, 'shared-slug', 'Second')`)
      await assert.rejects(db.exec(`INSERT INTO catalog.items(category_id, slug, title) VALUES (1, 'shared-slug', 'Duplicate')`), /unique constraint/)
      await db.exec(`INSERT INTO catalog.assets(provider, bucket, object_path, media_type) VALUES ('r2', 'archive', 'fonts/soft-serif.zip', 'file')`)
      await assert.rejects(db.exec(`INSERT INTO catalog.assets(provider, bucket, object_path) VALUES ('r2', 'archive', 'fonts/soft-serif.zip')`), /unique constraint/)
      await assert.rejects(db.exec(`INSERT INTO catalog.assets(provider, external_url) VALUES ('r2', 'https://example.com/file')`), /check constraint/)
    })

    await t.test('join constraints reject orphans, duplicates, and negative ordering', async () => {
      await db.exec(`INSERT INTO catalog.tags(slug, name) VALUES ('cozy', 'Cozy'); INSERT INTO catalog.item_tags(item_id, tag_id) VALUES (1, 1)`)
      await assert.rejects(db.exec(`INSERT INTO catalog.item_tags(item_id, tag_id) VALUES (1, 1)`), /unique constraint/)
      await assert.rejects(db.exec(`INSERT INTO catalog.item_tags(item_id, tag_id) VALUES (99999, 1)`), /foreign key/)
      await assert.rejects(db.exec(`INSERT INTO catalog.item_assets(item_id, asset_id, role) VALUES (1, 99999, 'gallery')`), /foreign key/)
      await assert.rejects(db.exec(`UPDATE catalog.item_assets SET sort_order = -1 WHERE item_id = 1`), /check constraint/)
      await assert.rejects(db.exec(`UPDATE catalog.item_facts SET sort_order = -1 WHERE item_id = 1`), /check constraint/)
      // Different assets must still not create a second cover.
      const asset = (await db.query<{ id: number }>(`SELECT id FROM catalog.assets WHERE provider = 'r2'`)).rows[0]
      await assert.rejects(db.query(`INSERT INTO catalog.item_assets(item_id, asset_id, role) VALUES (1, $1, 'cover')`, [asset.id]), /unique constraint/)
    })

    await t.test('metadata write validates the persisted category before updating JSONB', async () => {
      const adapter = { query: (sql: string, values?: unknown[]) => db.query<Record<string, unknown>>(sql, values) }
      await db.exec('BEGIN')
      await updateItemMetadata(adapter, '1', { width: 3840, height: 2160, image_count: 12 })
      await assert.rejects(updateItemMetadata(adapter, '1', { track_count: 8 }), /Unrecognized key/)
      await db.exec('COMMIT')
      assert.deepEqual((await db.query<{ metadata: unknown }>('SELECT metadata FROM catalog.items WHERE id = 1')).rows[0].metadata, { width: 3840, height: 2160, image_count: 12 })
      const imported = await db.query<{ metadata_schema_key: string; metadata: unknown }>(`SELECT c.metadata_schema_key, i.metadata FROM catalog.items i JOIN catalog.categories c ON c.id = i.category_id`)
      for (const row of imported.rows) parseCategoryMetadata(row.metadata_schema_key, row.metadata)
    })

    await db.exec(`CREATE ROLE catalog_test_runtime NOSUPERUSER NOBYPASSRLS;
      GRANT USAGE ON SCHEMA catalog TO catalog_test_runtime;
      GRANT SELECT ON ALL TABLES IN SCHEMA catalog TO catalog_test_runtime;
      GRANT INSERT, UPDATE, DELETE ON catalog.collections, catalog.collection_items TO catalog_test_runtime;
      GRANT INSERT ON catalog.profiles TO catalog_test_runtime;
      GRANT UPDATE(username, display_name, avatar_url) ON catalog.profiles TO catalog_test_runtime;
      GRANT USAGE ON SEQUENCE catalog.collections_id_seq TO catalog_test_runtime;
      INSERT INTO catalog.items(category_id, slug, title) VALUES (1, 'draft-item', 'Draft item');
      INSERT INTO catalog.assets(provider, external_url) VALUES ('external', 'https://example.com/private.png');
      INSERT INTO catalog.item_assets(item_id, asset_id, role)
        SELECT i.id, a.id, 'cover' FROM catalog.items i, catalog.assets a
        WHERE i.slug = 'draft-item' AND a.external_url = 'https://example.com/private.png';
      SET ROLE catalog_test_runtime;`)

    await t.test('public reads exclude drafts and their assets, and expose no private collections', async () => {
      assert.equal((await db.query('SELECT * FROM catalog.items')).rows.length, 9)
      assert.equal((await db.query('SELECT * FROM catalog.assets')).rows.length, 1)
      assert.equal((await db.query('SELECT * FROM catalog.collections')).rows.length, 0)
      await assert.rejects(db.exec(`INSERT INTO catalog.collections(owner_user_id, kind, slug, title) VALUES ('${alice}', 'saved', 'saved', 'Saved')`), /row-level security/)
      await assert.rejects(db.exec(`UPDATE catalog.items SET title = 'Not allowed' WHERE id = 1`), /permission denied/)
    })

    await t.test('verified owner can save once; another user cannot read, reassign, or mutate that collection', async () => {
      await db.query("SELECT set_config('app.user_id', $1, false)", [alice])
      await db.query(`INSERT INTO catalog.profiles(id, username) VALUES ($1, 'alice')`, [alice])
      await db.query(`INSERT INTO catalog.collections(owner_user_id, kind, slug, title) VALUES ($1, 'saved', 'saved', 'Saved')`, [alice])
      await db.exec(`INSERT INTO catalog.collection_items(collection_id, item_id)
        SELECT id, 1 FROM catalog.collections WHERE slug = 'saved'`)
      await assert.rejects(db.query(`INSERT INTO catalog.collections(owner_user_id, kind, slug, title) VALUES ($1, 'saved', 'another-saved', 'Saved')`, [alice]), /unique constraint/)
      await assert.rejects(db.exec(`UPDATE catalog.collections SET owner_user_id = '${bob}'`), /row-level security/)
      await assert.rejects(db.exec(`UPDATE catalog.collections SET is_public = true`), /check constraint/)
      const collection = (await db.query<{ id: number }>('SELECT id FROM catalog.collections')).rows[0].id
      await db.query("SELECT set_config('app.user_id', $1, false)", [bob])
      assert.equal((await db.query('SELECT * FROM catalog.collections')).rows.length, 0)
      assert.equal((await db.query('SELECT * FROM catalog.collection_items')).rows.length, 0)
      await assert.rejects(db.query('INSERT INTO catalog.collection_items(collection_id, item_id) VALUES ($1, 2)', [collection]), /row-level security/)
      assert.equal((await db.query('DELETE FROM catalog.collections RETURNING id')).rows.length, 0)
      assert.equal((await db.query('UPDATE catalog.collection_items SET sort_order = 9 RETURNING item_id')).rows.length, 0)
      await db.query("SELECT set_config('app.user_id', $1, false)", [alice])
      assert.equal((await db.query('SELECT * FROM catalog.collection_items')).rows.length, 1)
    })

    await t.test('profile ownership and column privileges prevent impersonation and role escalation', async () => {
      await db.query("SELECT set_config('app.user_id', $1, false)", [bob])
      assert.equal((await db.query('SELECT * FROM catalog.profiles')).rows.length, 0)
      await assert.rejects(db.query(`INSERT INTO catalog.profiles(id, role) VALUES ($1, 'admin')`, [bob]), /row-level security/)
      await assert.rejects(db.query(`INSERT INTO catalog.profiles(id, username) VALUES ($1, 'alice')`, [bob]), /unique constraint/)
      await db.query(`INSERT INTO catalog.profiles(id, username) VALUES ($1, 'bob')`, [bob])
      await db.exec(`UPDATE catalog.profiles SET display_name = 'Bobby'`)
      await assert.rejects(db.exec(`UPDATE catalog.profiles SET role = 'admin'`), /permission denied/)
      // Defense in depth: a mistaken broad UPDATE grant still cannot elevate a role.
      await db.exec('RESET ROLE; GRANT UPDATE ON catalog.profiles TO catalog_test_runtime; SET ROLE catalog_test_runtime;')
      await assert.rejects(db.exec(`UPDATE catalog.profiles SET role = 'admin'`), /Only trusted profile administrators/)
      await assert.rejects(db.exec(`UPDATE catalog.profiles SET id = '${alice}'`), /Profile identity cannot be changed/)
      await db.exec('RESET ROLE; REVOKE UPDATE ON catalog.profiles FROM catalog_test_runtime; GRANT UPDATE(username, display_name, avatar_url) ON catalog.profiles TO catalog_test_runtime; SET ROLE catalog_test_runtime;')
      await db.query("SELECT set_config('app.user_id', $1, false)", [alice])
      assert.equal((await db.query<{ display_name: string }>('SELECT display_name FROM catalog.profiles')).rows[0].display_name, '')
    })

    await t.test('public collections are readable but still writable only by their owner', async () => {
      await db.query(`INSERT INTO catalog.collections(owner_user_id, slug, title, is_public) VALUES ($1, 'favorites', 'Favorites', true)`, [alice])
      const publicId = (await db.query<{ id: number }>(`SELECT id FROM catalog.collections WHERE slug = 'favorites'`)).rows[0].id
      await db.query('INSERT INTO catalog.collection_items(collection_id, item_id) VALUES ($1, 2)', [publicId])
      await db.query("SELECT set_config('app.user_id', '', false)")
      assert.equal((await db.query('SELECT * FROM catalog.collections')).rows.length, 1)
      assert.equal((await db.query('SELECT * FROM catalog.collection_items')).rows.length, 1)
      await assert.rejects(db.query('INSERT INTO catalog.collection_items(collection_id, item_id) VALUES ($1, 3)', [publicId]), /row-level security/)
      await db.exec('BEGIN')
      await db.query("SELECT set_config('app.user_id', $1, true)", [alice])
      assert.equal((await db.query('SELECT * FROM catalog.collections')).rows.length, 2)
      await db.exec('COMMIT')
      assert.equal((await db.query('SELECT * FROM catalog.collections')).rows.length, 1, 'identity must not leak to the next transaction')
    })

    await t.test('inactive categories hide their items and checksum drift stops migrations', async () => {
      await db.exec('RESET ROLE')
      await db.exec(`UPDATE catalog.categories SET is_active = false WHERE slug = 'fonts'; SET ROLE catalog_test_runtime;`)
      assert.equal((await db.query(`SELECT * FROM catalog.items WHERE slug = 'soft-serif'`)).rows.length, 0)
      await db.exec('RESET ROLE')
      await db.exec(`UPDATE schema_migrations SET checksum = 'tampered' WHERE name = '0002_catalog_entities.sql'`)
      await assert.rejects(migrate(connection(db)), /Applied migration was modified/)
    })
  } finally {
    await db.close()
  }
})

test('upgrading an existing catalog backfills profiles and cascades collection cleanup', async () => {
  const db = new PGlite()
  try {
    await seedLegacy(db)
    await db.exec('BEGIN')
    await db.exec(await readFile('db/migrations/0002_catalog_entities.sql', 'utf8'))
    await db.exec('COMMIT')
    await db.query(`INSERT INTO catalog.collections(owner_user_id, kind, slug, title) VALUES ($1, 'saved', 'saved', 'Saved')`, [alice])
    await db.exec('INSERT INTO catalog.collection_items(collection_id, item_id) VALUES (1, 1)')
    await db.exec('BEGIN')
    await db.exec(await readFile('db/migrations/0003_catalog_profiles_and_validation.sql', 'utf8'))
    await db.exec('COMMIT')
    assert.equal((await db.query('SELECT * FROM catalog.profiles')).rows.length, 1)
    await db.query('DELETE FROM catalog.profiles WHERE id = $1', [alice])
    assert.equal((await db.query('SELECT * FROM catalog.collection_items')).rows.length, 0)
    assert.equal((await db.query('SELECT * FROM catalog.collections')).rows.length, 0)
    assert.equal((await db.query('SELECT * FROM catalog.items')).rows.length, 8)
  } finally { await db.close() }
})

test('Zod rejects unknown schema keys, incompatible fields, invalid types, and partial dimensions', () => {
  assert.deepEqual(parseCategoryMetadata('music.v1', { track_count: 8, duration_seconds: 1920 }), { track_count: 8, duration_seconds: 1920 })
  assert.deepEqual(parseCategoryMetadata('games.v1', { platforms: ['windows'], size_bytes: 326000000 }), { platforms: ['windows'], size_bytes: 326000000 })
  for (const [key, input] of [
    ['music.v1', { track_count: '8' }], ['music.v1', { track_count: -1 }],
    ['music.v1', { track_count: 1.5 }], ['music.v1', { owner_user_id: alice }],
    ['wallpapers.v1', { width: 1920 }], ['games.v1', { size_bytes: Number.MAX_SAFE_INTEGER + 1 }],
    ['games.v1', { platforms: ['unknown'] }], ['generic.v1', { anything: true }],
    ['missing.v1', {}], ['constructor', {}], ['music.v1', []],
  ] as const) assert.throws(() => parseCategoryMetadata(key, input))
})

test('a failed backfill rolls back the complete migration, preserving original data', async () => {
  const db = new PGlite()
  try {
    await seedLegacy(db)
    await db.exec(`UPDATE archive_items SET image = 'http://invalid-legacy-url' WHERE title = 'Exploding Werewolf'`)
    await assert.rejects(migrate(connection(db)), /check constraint/)
    assert.equal((await db.query('SELECT * FROM archive_items')).rows.length, 8)
    assert.equal((await db.query(`SELECT * FROM pg_namespace WHERE nspname = 'catalog'`)).rows.length, 0)
    assert.equal((await db.query<{ table_name: string | null }>(`SELECT to_regclass('public.schema_migrations') AS table_name`)).rows[0].table_name, null)
  } finally {
    await db.close()
  }
})

test('empty database can migrate without demo seeding', async () => {
  const db = new PGlite()
  try {
    await migrate(connection(db))
    assert.equal((await db.query('SELECT * FROM catalog.categories')).rows.length, 3)
    assert.equal((await db.query('SELECT * FROM catalog.items')).rows.length, 0)
  } finally {
    await db.close()
  }
})
