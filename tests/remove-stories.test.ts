import assert from 'node:assert/strict'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { readMigrations } from '../scripts/migrations'

test('Stories retirement removes chapters and exclusive files while preserving other content and agent boundaries', async () => {
  const db = new PGlite()
  try {
    const migrations = await readMigrations()
    const retirement = migrations.find(m => m.name === '0021_remove_stories.sql')!
    for (const migration of migrations.filter(m => m.name < retirement.name)) await db.exec(`BEGIN;\n${migration.sql}\nCOMMIT;`)
    await db.exec(`
      INSERT INTO catalog.categories(slug,name,metadata_schema_key) VALUES('stories','Stories','stories.v1');
      CREATE TABLE catalog.story_chapters (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        item_id bigint NOT NULL REFERENCES catalog.items(id) ON DELETE CASCADE,
        chapter_number integer NOT NULL, content_markdown text NOT NULL
      );
      INSERT INTO catalog.items(category_id,slug,title)
        SELECT id,'removed-story','Removed story' FROM catalog.categories WHERE slug='stories';
      INSERT INTO catalog.items(category_id,slug,title)
        SELECT id,'retained-image','Retained image' FROM catalog.categories WHERE slug='images';
      INSERT INTO catalog.story_chapters(item_id,chapter_number,content_markdown)
        SELECT id,1,'Chapter text' FROM catalog.items WHERE slug='removed-story';
      INSERT INTO catalog.assets(provider,external_url) VALUES
        ('external','https://example.com/shared.png'),('external','https://example.com/story-only.png');
      INSERT INTO catalog.item_assets(item_id,asset_id,role)
        SELECT i.id,a.id,'download' FROM catalog.items i CROSS JOIN catalog.assets a
        WHERE i.slug='removed-story' OR (i.slug='retained-image' AND a.external_url='https://example.com/shared.png');
      INSERT INTO catalog.item_facts(item_id,key,label,value)
        SELECT id,'creator','Creator','Fixture' FROM catalog.items;
      INSERT INTO catalog.tags(slug,name) VALUES('stories','Stories'),('shared-tag','Shared tag');
      INSERT INTO catalog.item_tags(item_id,tag_id)
        SELECT i.id,t.id FROM catalog.items i CROSS JOIN catalog.tags t
        WHERE t.slug='shared-tag' OR (i.slug='removed-story' AND t.slug='stories');
      INSERT INTO automation.agents(name,allowed_categories) VALUES
        ('story-only',ARRAY(SELECT id FROM catalog.categories WHERE slug='stories')),
        ('mixed',ARRAY(SELECT id FROM catalog.categories WHERE slug IN ('stories','images')));
    `)
    const before = (await db.query("SELECT to_jsonb(i) AS doc FROM catalog.items i WHERE slug='retained-image'")).rows
    const imageId = (await db.query<{ id: number }>("SELECT id FROM catalog.categories WHERE slug='images'")).rows[0].id
    const storyId = (await db.query<{ id: number }>("SELECT id FROM catalog.categories WHERE slug='stories'")).rows[0].id
    // Unexpected receipts must stop removal atomically instead of erasing audit history.
    await db.exec(`INSERT INTO automation.api_keys(agent_id,label,secret_hash,scopes,expires_at)
      SELECT id,'fixture',repeat('a',64),ARRAY['catalog:read'],now()+interval '1 day' FROM automation.agents WHERE name='mixed';
      INSERT INTO automation.jobs(agent_id,key_id,idempotency_key,payload_hash,category_id,reserved_item_id)
      SELECT a.id,k.id,'historical-job',repeat('b',64),${storyId},9999 FROM automation.agents a
      JOIN automation.api_keys k ON k.agent_id=a.id WHERE a.name='mixed';`)
    await db.exec('BEGIN')
    await assert.rejects(db.exec(retirement.sql), /Stories has agent job history/)
    await db.exec('ROLLBACK')
    assert.equal((await db.query<{ total: number }>('SELECT count(*)::int AS total FROM catalog.story_chapters')).rows[0].total, 1)
    await db.exec('DELETE FROM automation.jobs')
    await db.exec(`BEGIN;\n${retirement.sql}\nCOMMIT;`)
    assert.equal((await db.query<{ name: string | null }>("SELECT to_regclass('catalog.story_chapters') AS name")).rows[0].name, null)
    assert.equal((await db.query("SELECT id FROM catalog.categories WHERE slug='stories'")).rows.length, 0)
    assert.equal((await db.query("SELECT id FROM catalog.items WHERE slug='removed-story'")).rows.length, 0)
    assert.deepEqual((await db.query("SELECT to_jsonb(i) AS doc FROM catalog.items i WHERE slug='retained-image'")).rows, before)
    assert.equal((await db.query('SELECT * FROM catalog.item_facts')).rows.length, 1)
    assert.equal((await db.query('SELECT * FROM catalog.item_tags')).rows.length, 1)
    assert.equal((await db.query("SELECT * FROM catalog.tags WHERE slug='stories'")).rows.length, 0)
    assert.deepEqual((await db.query('SELECT external_url FROM catalog.assets')).rows, [{ external_url: 'https://example.com/shared.png' }])
    const agents = (await db.query<{ name: string; active: boolean; allowed_categories: number[] }>('SELECT name,active,allowed_categories FROM automation.agents ORDER BY name')).rows
    assert.deepEqual(agents, [{ name: 'mixed', active: true, allowed_categories: [imageId] }, { name: 'story-only', active: false, allowed_categories: [] }])
    await assert.rejects(db.exec("UPDATE automation.agents SET active=true WHERE name='story-only'"), /check constraint/)
    const definitions = (await db.query<{ definition: string }>(`SELECT pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='automation' AND p.proname IN ('check_key','catalog')`)).rows
    assert.ok(definitions.every(row => !row.definition.includes('stories')))
    assert.ok(definitions.every(row => row.definition.includes('SECURITY DEFINER')))
    // Fresh installs have no story table/data; the retirement is still safe to run.
    await db.exec(`BEGIN;\n${retirement.sql}\nCOMMIT;`)
    assert.deepEqual((await db.query("SELECT to_jsonb(i) AS doc FROM catalog.items i WHERE slug='retained-image'")).rows, before)
  } finally { await db.close() }
})
