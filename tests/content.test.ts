import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { contentSchema, attachmentSchema, fileType, validateStoryContent } from '../lib/admin/content'
import { parseCategoryMetadata } from '../lib/entities/metadata'
import { createContentQuery } from '../server/repositories/content-write'
import { deleteContentQuery } from '../server/repositories/content-delete'
import { createItemSlug } from '../server/services/item-slug'
import { createContentWithTitleSlug } from '../server/services/content-create'
import { cardsQuery } from '../server/repositories/catalog.queries'

const admin = '00000000-0000-4000-8000-000000000001'
const member = '00000000-0000-4000-8000-000000000002'
const item = { categoryId: '1', title: 'New find', slug: 'new-find', summary: 'Summary', description: '',
  status: 'published', accentColor: '#f1e5dd', isFeatured: false, sortOrder: 0, metadata: {},
  facts: [{ key: 'license', label: 'License', value: 'Personal use' }], tags: [{ slug: 'cozy', name: 'Cozy' }], attachments: [] }

test('automatic item slugs handle repeated titles, Unicode and URL-unsafe characters', () => {
  assert.equal(createItemSlug('Sunset'), 'sunset')
  assert.equal(createItemSlug('Đêm yên bình'), 'dem-yen-binh')
  for (const title of ['../Sunset?use=avatar', '🌄', '夜景', 'A'.repeat(200)]) {
    const generated = createItemSlug(title)
    assert.match(generated, /^[a-z0-9]+(-[a-z0-9]+)*$/)
    assert.ok(generated.length <= 120)
  }
})

test('content validation rejects invalid publication, facts, roles and category metadata', () => {
  const valid = { ...item, attachments: [{ path: `${admin}/${member}.png`, altText: 'Original image' }] }
  assert.equal(contentSchema.safeParse(valid).success, true)
  const { description: _description, ...withoutDescription } = valid
  const storyInput = contentSchema.safeParse(withoutDescription)
  assert.equal(storyInput.success, true)
  if (storyInput.success) assert.equal(storyInput.data.description, '')
  assert.equal(contentSchema.safeParse({ ...valid, status: 'draft' }).success, false)
  assert.equal(contentSchema.safeParse({ ...valid, uses: ['wallpaper', 'background', 'avatar'] }).success, true)
  assert.equal(contentSchema.safeParse({ ...valid, initialChapter: { chapterNumber: 1, contentMarkdown: '# Chapter 1' } }).success, true)
  assert.equal(contentSchema.safeParse({ ...valid, initialChapter: { chapterNumber: 0, contentMarkdown: '# Chapter 1' } }).success, false)
  assert.equal(contentSchema.safeParse({ ...valid, uses: ['avatar', 'avatar'] }).success, false)
  assert.equal(contentSchema.safeParse({ ...valid, attachments: [] }).success, false)
  assert.equal(contentSchema.safeParse({ ...valid, status: 'published', attachments: [{ path: `${admin}/${member}.png`, role: 'download', altText: 'Original sunset' }] }).success, true)
  for (const role of ['gallery', 'preview']) {
    assert.equal(contentSchema.safeParse({ ...valid, attachments: [{ path: `${admin}/${member}.png`, role, altText: 'Original image' }] }).success, false)
  }
  assert.equal(attachmentSchema.parse({ path: `${admin}/${member}.png`, role: 'cover', altText: 'Thumbnail' }).role, 'cover')
  assert.equal(contentSchema.safeParse({ ...valid, facts: [...item.facts, ...item.facts] }).success, false)
  assert.equal(Object.hasOwn(contentSchema.parse({ ...valid, slug: '../escape' }), 'slug'), false)
  const { slug: _slug, ...withoutSlug } = valid
  assert.equal(contentSchema.safeParse(withoutSlug).success, true)
  assert.equal(fileType('payload.svg'), null)
  assert.equal(fileType('game.ZIP')?.mediaType, 'file')
  assert.equal(fileType('track.flac')?.mediaType, 'audio')
  const storyCover = { path: `${admin}/${member}.png`, altText: 'Book cover', role: 'download' as const, focalX: 50, focalY: 50 }
  assert.equal(validateStoryContent([storyCover]), null)
  assert.equal(validateStoryContent([]), 'Upload one image to use as the book cover.')
  assert.equal(validateStoryContent([storyCover, storyCover]), 'Upload one image to use as the book cover.')
  assert.throws(() => parseCategoryMetadata('images.v1', { width: 1920 }))
  assert.throws(() => parseCategoryMetadata('games.v1', { platforms: ['invalid'] }))
  assert.throws(() => parseCategoryMetadata('music.v1', { track_count: -1 }))
  assert.equal(attachmentSchema.parse({ path: `${admin}/${member}.zip`, altText: 'Package' }).role, 'download')
})

test('content write is atomic, rechecks admin role and rejects category schema races', { timeout: 30000 }, async () => {
  const db = new PGlite()
  try {
    await db.exec('BEGIN')
    for (const file of ['0001_archive_items.sql', '0002_catalog_entities.sql', '0003_catalog_profiles_and_validation.sql', '0004_content_uses.sql', '0005_remove_legacy_catalog.sql', '0006_browse_uses.sql', '0007_s3_assets.sql', '0008_original_and_thumbnail.sql', '0009_publish_only.sql', '0010_permanent_usernames.sql', '0011_asset_packs.sql', '0012_trim_unused_catalog_fields.sql', '0013_profile_avatar_path.sql', '0014_stories_content_type.sql', '0015_story_chapters.sql']) {
      await db.exec(await readFile(`db/migrations/${file}`, 'utf8'))
    }
    await db.exec('COMMIT')
    await db.query(`INSERT INTO catalog.profiles(id, role) VALUES ($1, 'admin'), ($2, 'member')`, [admin, member])
    const category = (await db.query<{ id: string; metadata_schema_key: string }>(`SELECT id::text, metadata_schema_key FROM catalog.categories ORDER BY id LIMIT 1`)).rows[0]
    const storyCategory = (await db.query<{ id: string }>("SELECT id::text FROM catalog.categories WHERE slug = 'stories'")).rows[0]
    const write = (actor: string, slug: string, schema = category.metadata_schema_key, attachments: unknown[] = []) => db.query(createContentQuery,
      [actor, category.id, schema, JSON.stringify({ ...item, slug, attachments }), 'private-uploads'])
    assert.equal((await write(member, 'forbidden')).rows.length, 0)
    assert.equal((await write(admin, 'wrong-schema', 'unknown.v1')).rows.length, 0)
    assert.equal((await write(admin, 'valid')).rows.length, 1)
    assert.equal((await db.query('SELECT * FROM catalog.item_facts')).rows.length, 1)
    assert.equal((await db.query('SELECT * FROM catalog.item_tags')).rows.length, 1)
    const storyText = 'Once upon a time, the moon was listening.'
    const storyDescription = 'A quiet tale about following a mysterious blue light.'
    const storyResult = await db.query(createContentQuery, [admin, storyCategory.id, 'stories.v1',
        JSON.stringify({ ...item, slug: 'moon-listener', title: 'Moon Listener', summary: storyText, description: storyDescription,
          initialChapter: { chapterNumber: 1, contentMarkdown: `# Chapter One\n\n${storyText}` },
          facts: [], tags: [], attachments: [] }), 'private-uploads'])
      assert.equal(storyResult.rows.length, 1)
      assert.equal((await db.query<{ description: string }>("SELECT description FROM catalog.items WHERE slug = 'moon-listener'")).rows[0].description, storyDescription)
      assert.deepEqual((await db.query<{ chapter_number: number; content_markdown: string }>(
        "SELECT chapter_number, content_markdown FROM catalog.story_chapters WHERE item_id = (SELECT id FROM catalog.items WHERE slug = 'moon-listener')"))
        .rows[0], { chapter_number: 1, content_markdown: `# Chapter One\n\n${storyText}` })
    assert.deepEqual((await db.query<{ use_slug: string }>('SELECT use_slug FROM catalog.item_uses ORDER BY use_slug')).rows.map(row => row.use_slug), ['images', 'stories'])
    const withUses = { ...item, slug: 'multi-use', uses: ['images', 'wallpaper', 'background', 'avatar'] }
    await db.query(createContentQuery, [admin, category.id, category.metadata_schema_key, JSON.stringify(withUses), 'private-uploads'])
    assert.equal((await db.query('SELECT * FROM catalog.item_uses')).rows.length, 6)
    await assert.rejects(db.query(createContentQuery, [admin, category.id, category.metadata_schema_key,
      JSON.stringify({ ...item, slug: 'unknown-use', uses: ['avatar', 'missing'] }), 'private-uploads']))
    assert.equal((await db.query("SELECT * FROM catalog.items WHERE slug = 'unknown-use'")).rows.length, 0)
    const asset = { path: `${admin}/${member}.png`, role: 'cover', altText: 'A scene',
      focalX: 50, focalY: 50, mediaType: 'image', mime: 'image/png', byteSize: 20 }
    assert.equal((await write(admin, 'with-cover', category.metadata_schema_key, [asset])).rows.length, 1)
    assert.equal((await db.query('SELECT * FROM catalog.item_assets')).rows.length, 1)
    assert.equal((await db.query('SELECT * FROM catalog.tags')).rows.length, 1)
    await assert.rejects(write(admin, 'rollback', category.metadata_schema_key, [{ path: 'broken', mediaType: 'invalid', mime: 'image/png', byteSize: 10 }]))
    assert.equal((await db.query(`SELECT * FROM catalog.items WHERE slug = 'rollback'`)).rows.length, 0)
    const original = { ...asset, path: `content/${admin}/original.png`, role: 'download', width: 2400, height: 1600 }
    const thumbnail = { ...asset, path: `content/${admin}/thumbnail.webp`, mime: 'image/webp', width: 800, height: 533 }
    await write(admin, 'image-pair', category.metadata_schema_key, [original, thumbnail])
    const pair = (await db.query<{ role: string; width: number; object_path: string }>(`SELECT ia.role, a.width, a.object_path
      FROM catalog.item_assets ia JOIN catalog.assets a ON a.id=ia.asset_id JOIN catalog.items i ON i.id=ia.item_id
      WHERE i.slug='image-pair' ORDER BY ia.role`)).rows
    assert.deepEqual(pair.map(a => [a.role, a.width]), [['cover', 800], ['download', 2400]])
    assert.notEqual(pair[0].object_path, pair[1].object_path)
    const query = async (text: string, values: unknown[]) => (await db.query<Record<string, unknown>>(text, values)).rows
    const [reserved] = await query("SELECT nextval(pg_get_serial_sequence('catalog.items', 'id'))::text AS id", [])
    const reservedRows = await createContentWithTitleSlug(query, admin, category.id, category.metadata_schema_key,
      { ...item, title: 'Reserved identity', reservedItemId: reserved.id,
        attachments: [{ ...original, path: `image/${reserved.id}/originals/original.png` },
          { ...thumbnail, path: `image/${reserved.id}/thumbnail.webp` }] }, 'private-uploads')
    assert.equal(reservedRows[0].id, reserved.id)
    assert.equal(Object.hasOwn(contentSchema.parse({ ...item, reservedItemId: '999', attachments: [{ path: `${admin}/${member}.png`, altText: 'Image' }] }), 'reservedItemId'), false)
    for (const expected of ['sunset', 'sunset-1', 'sunset-2', 'sunset-3', 'sunset-4', 'sunset-5']) {
      const rows = await createContentWithTitleSlug(query, admin, category.id, category.metadata_schema_key,
        { ...item, title: 'Sunset', uses: ['avatar'] }, 'private-uploads')
      assert.equal(rows[0].slug, expected)
    }
    const music = (await db.query<{ id: string; metadata_schema_key: string }>("SELECT id::text, metadata_schema_key FROM catalog.categories WHERE slug = 'music'")).rows[0]
    const musicItem = await createContentWithTitleSlug(query, admin, music.id, music.metadata_schema_key,
      { ...item, status: 'archived', title: 'Audio with artwork', metadata: { track_count: 1, duration_seconds: 12, formats: ['wav'] }, attachments: [
        { ...thumbnail, path: 'audio/fixture/thumbnail.webp' },
        { ...original, path: 'audio/fixture/originals/track.wav', mediaType: 'audio', mime: 'audio/wav', width: undefined, height: undefined, durationSeconds: 12.25 },
      ] }, 'private-uploads')
    const musicAssets = await query(`SELECT ia.role,a.media_type,a.duration_seconds::text FROM catalog.item_assets ia
      JOIN catalog.assets a ON a.id=ia.asset_id WHERE ia.item_id=$1::bigint ORDER BY ia.role`, [musicItem[0].id])
    assert.deepEqual(musicAssets, [{ role: 'cover', media_type: 'image', duration_seconds: null },
      { role: 'download', media_type: 'audio', duration_seconds: '12.250' }])
    assert.equal((await query(cardsQuery, ['music', musicItem[0].slug, null])).length, 0)
    await db.query("UPDATE catalog.items SET status='published',published_at=now() WHERE id=$1::bigint", [musicItem[0].id])
    const [loadedMusic] = await query(cardsQuery, ['music', musicItem[0].slug, null])
    const loadedAssets = loadedMusic.assets as Array<{ role: string; mediaType: string; objectPath: string }>
    assert.deepEqual(loadedAssets.map(asset => [asset.role, asset.mediaType, asset.objectPath]), [
      ['cover', 'image', 'audio/fixture/thumbnail.webp'],
      ['download', 'audio', 'audio/fixture/originals/track.wav'],
    ])
    assert.equal((await createContentWithTitleSlug(query, admin, music.id, music.metadata_schema_key,
      { ...item, title: 'Sunset' }, 'private-uploads'))[0].slug, 'sunset')
    let insertedCompetitor = false
    const competingQuery = async (text: string, values: unknown[]) => {
      if (text === createContentQuery && !insertedCompetitor) {
        insertedCompetitor = true
        await query(text, values)
      }
      return query(text, values)
    }
    assert.equal((await createContentWithTitleSlug(competingQuery, admin, category.id, category.metadata_schema_key,
      { ...item, title: 'Concurrent title' }, 'private-uploads'))[0].slug, 'concurrent-title-1')
    const unrelatedConflict = Object.assign(new Error('Duplicate attachment'), { code: '23505', constraint: 'assets_storage_path_idx' })
    await assert.rejects(createContentWithTitleSlug(async text => {
      if (text === createContentQuery) throw unrelatedConflict
      return []
    }, admin, category.id, category.metadata_schema_key, { ...item, title: 'No retry' }, 'private-uploads'), error => error === unrelatedConflict)
    const doomed = (await db.query<{ id: string }>("SELECT id::text FROM catalog.items WHERE slug = 'image-pair'")).rows[0]
    const survivor = (await db.query<{ id: string }>("SELECT id::text FROM catalog.items WHERE slug = 'valid'")).rows[0]
    await db.query(`INSERT INTO catalog.item_assets(item_id, asset_id, role)
      SELECT $1::bigint, asset_id, 'download' FROM catalog.item_assets WHERE item_id = $2::bigint AND role = 'download'`, [survivor.id, doomed.id])
    assert.equal((await db.query(deleteContentQuery, [member, doomed.id])).rows.length, 0)
    assert.equal((await db.query(deleteContentQuery, ['00000000-0000-4000-8000-000000000099', doomed.id])).rows.length, 0)
    const deleted = (await db.query<{ assets: Array<{ object_path: string }> }>(deleteContentQuery, [admin, doomed.id])).rows[0]
    assert.deepEqual(deleted.assets.map(asset => asset.object_path), [thumbnail.path])
    for (const table of ['items', 'item_assets', 'item_facts', 'item_tags', 'item_uses']) {
      assert.equal((await db.query(`SELECT 1 FROM catalog.${table} WHERE ${table === 'items' ? 'id' : 'item_id'} = $1::bigint`, [doomed.id])).rows.length, 0)
    }
    assert.equal((await db.query('SELECT 1 FROM catalog.assets WHERE object_path = $1', [original.path])).rows.length, 1)
    assert.equal((await db.query('SELECT 1 FROM catalog.assets WHERE object_path = $1', [thumbnail.path])).rows.length, 0)
    assert.equal((await db.query(deleteContentQuery, [admin, doomed.id])).rows.length, 0)
    const noAssets = (await write(admin, 'delete-no-assets')).rows[0] as { id: string }
    assert.deepEqual((await db.query<{ assets: unknown[] }>(deleteContentQuery, [admin, noAssets.id])).rows[0].assets, [])
    await db.query(`UPDATE catalog.profiles SET role = 'member' WHERE id = $1`, [admin])
    assert.equal((await db.query(deleteContentQuery, [admin, survivor.id])).rows.length, 0)
    assert.equal((await write(admin, 'demoted')).rows.length, 0)
  } finally { await db.close() }
})
