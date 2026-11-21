import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { migrate } from '../scripts/migrations'
import { agentPayloadHash, newAgentCredential, parseAgentCredential } from '../lib/agent-identity'
import { itemStorageDirectory } from '../lib/admin/storage-paths'
import { cardsQuery } from '../server/repositories/catalog.queries'
import { setContentStatusQuery } from '../server/repositories/content-edit'
import { adminCatalogCountQuery, adminCatalogPageQuery } from '../server/repositories/admin-catalog.queries'
import { adminCatalogHref, adminCatalogParams, parseAdminCatalogFilters } from '../lib/admin/catalog-filters'

test('agent secrets are opaque, independently identified and hashed; payload hashes are canonical', () => {
  const key = newAgentCredential()
  assert.deepEqual(parseAgentCredential(`Bearer ${key.token}`), { keyId: key.keyId, tokenHash: key.tokenHash })
  assert.notEqual(key.token, newAgentCredential().token)
  assert.equal(parseAgentCredential(`Bearer ${'x'.repeat(43)}`), null)
  assert.equal(parseAgentCredential(`Bearer ${key.token}\n`), null)
  assert.equal(agentPayloadHash({ b: 2, a: { y: 1, x: 0 } }), agentPayloadHash({ a: { x: 0, y: 1 }, b: 2 }))
})

test('owned draft edits preserve omitted fields, files and draft visibility, reject stale writes and replay exactly once', async () => {
  const f = await fixture()
  try {
    const job = await f.start()
    const doc = { ...f.document(job), description: 'Original description', summary: 'Keep summary' }
    await f.call('publish_job', [job.id, job.leaseToken, 'images.v1', JSON.stringify(doc), 'assets'])
    const before = await f.call<{ updatedAt: string; files: unknown[] }>('draft', [job.itemId])
    const changes = { title: 'Updated title', description: 'Updated description', tags: [{ slug: 'cozy', name: 'Cozy' }], downloadSources: [{provider:'github',url:'https://github.com/pixinium/updated'}] }
    const hash = agentPayloadHash(changes)
    const args = [job.itemId, 'edit-1', hash, before.updatedAt, JSON.stringify(changes)]
    const saved = await f.call<{ updatedAt: string; status: string; summary: string; files: unknown[]; title: string }>('update_draft', args)
    assert.equal(saved.title, 'Updated title')
    assert.equal(saved.summary, 'Keep summary')
    assert.equal(saved.status, 'draft')
    assert.deepEqual(saved.files, before.files)
    assert.deepEqual(await f.call('update_draft', args), saved)
    await assert.rejects(f.call('update_draft', [job.itemId,'edit-1',agentPayloadHash({title:'Different'}),saved.updatedAt,'{"title":"Different"}']), (e: {code:string}) => e.code==='P0409')
    await assert.rejects(f.call('update_draft', [job.itemId,'edit-2',hash,before.updatedAt,JSON.stringify(changes)]), (e: {code:string}) => e.code==='P0409')
    for (const patch of [{status:'published'}, {categoryId:f.otherCategory}, {slug:'new-slug'}, {attachments:[]}, {metadata:{}}, {facts:[]}, {title:null}, {tags:[{slug:'bad slug',name:'Invalid'}]}]) {
      await assert.rejects(f.call('update_draft', [job.itemId,randomUUID(),agentPayloadHash(patch),saved.updatedAt,JSON.stringify(patch)]), (e: {code:string}) => ['P0422','P0403'].includes(e.code))
    }
    const drafts = await f.call<{drafts:Array<{id:string}>;nextCursor:string|null}>('drafts', [null])
    assert.deepEqual(drafts.drafts.map(d=>d.id), [job.itemId])
    await f.db.exec('RESET ROLE')
    assert.equal((await f.db.query<{n:number}>("SELECT count(*)::int AS n FROM automation.audit_events WHERE action='draft_updated'")).rows[0].n, 1)
    assert.deepEqual((await f.db.query('SELECT status,published_at,slug FROM catalog.items WHERE id=$1',[job.itemId])).rows[0], {status:'draft',published_at:null,slug:doc.slug})
    const rotated=newAgentCredential()
    await f.db.query("INSERT INTO automation.api_keys(id,agent_id,label,secret_hash,scopes,expires_at) VALUES($1,$2,'rotated',$3,ARRAY['content:edit'],now()+interval '1 day')",[rotated.keyId,f.agent,rotated.tokenHash])
    await f.db.exec('SET ROLE pixinium_agent')
    assert.deepEqual(await f.call('update_draft',args,rotated),saved)
  } finally { await f.db.close() }
})

test('owned draft listing uses bounded cursor pages with no duplicates',async()=>{
  const f=await fixture({jobs:30})
  try{
    for(let index=0;index<23;index++){
      const job=await f.start()
      await f.call('publish_job',[job.id,job.leaseToken,'images.v1',JSON.stringify(f.document(job)),'assets'])
    }
    type Page={drafts:Array<{id:string}>;nextCursor:string|null}
    const first=await f.call<Page>('drafts',[null])
    assert.equal(first.drafts.length,20)
    assert.equal(first.nextCursor,first.drafts[19].id)
    const second=await f.call<Page>('drafts',[first.nextCursor])
    assert.equal(second.drafts.length,3);assert.equal(second.nextCursor,null)
    assert.equal(new Set([...first.drafts,...second.drafts].map(d=>d.id)).size,23)
  }finally{await f.db.close()}
})

test('draft brokers reject other owners, missing scopes, revoked keys, disallowed categories and published items', async () => {
  const f = await fixture()
  try {
    const job = await f.start()
    await f.call('publish_job', [job.id,job.leaseToken,'images.v1',JSON.stringify(f.document(job)),'assets'])
    const draft = await f.call<{updatedAt:string}>('draft',[job.itemId])
    const edit = (key=f.key) => f.call('update_draft',[job.itemId,randomUUID(),agentPayloadHash({title:'Denied'}),draft.updatedAt,'{"title":"Denied"}'],key)
    const other = randomUUID(), otherKey = newAgentCredential()
    await f.db.exec('RESET ROLE')
    await f.db.query("INSERT INTO automation.agents(id,name,allowed_categories) VALUES($1,'other',$2)",[other,[f.category]])
    await f.db.query("INSERT INTO automation.api_keys(id,agent_id,label,secret_hash,scopes,expires_at) VALUES($1,$2,'other',$3,ARRAY['content:edit'],now()+interval '1 day')",[otherKey.keyId,other,otherKey.tokenHash])
    await f.db.exec('SET ROLE pixinium_agent')
    await assert.rejects(edit(otherKey),(e:{code:string})=>e.code==='P0403')
    await assert.rejects(f.call('draft',[job.itemId],otherKey),(e:{code:string})=>e.code==='P0403')
    assert.deepEqual(await f.call('drafts',[null],otherKey),{drafts:[],nextCursor:null})
    for(const statement of ["UPDATE automation.api_keys SET scopes=ARRAY['content:create'] WHERE id=$1",'UPDATE automation.api_keys SET revoked_at=now() WHERE id=$1']) {
      await f.db.exec('RESET ROLE'); await f.db.query(statement,[f.key.keyId]); await f.db.exec('SET ROLE pixinium_agent')
      await assert.rejects(edit(),(e:{code:string})=>['P0403','P0401'].includes(e.code))
    }
    await f.db.exec('RESET ROLE')
    await f.db.query("UPDATE automation.api_keys SET scopes=ARRAY['content:edit'],revoked_at=NULL WHERE id=$1",[f.key.keyId])
    await f.db.query('UPDATE automation.agents SET allowed_categories=$1 WHERE id=$2',[[f.otherCategory],f.agent])
    await f.db.exec('SET ROLE pixinium_agent')
    await assert.rejects(edit(),(e:{code:string})=>e.code==='P0403')
    await f.db.exec('RESET ROLE')
    await f.db.query('UPDATE automation.agents SET allowed_categories=$1 WHERE id=$2',[[f.category],f.agent])
    await f.db.query("UPDATE catalog.items SET status='published',published_at=now() WHERE id=$1",[job.itemId])
    await f.db.exec('SET ROLE pixinium_agent')
    await assert.rejects(edit(),(e:{code:string})=>e.code==='P0403')
    await assert.rejects(f.call('draft',[job.itemId]),(e:{code:string})=>e.code==='P0403')
    assert.deepEqual(await f.call('drafts',[null]),{drafts:[],nextCursor:null})
    await assert.rejects(f.db.query('UPDATE catalog.items SET status=\'published\' WHERE id=$1',[job.itemId]),(e:{code:string})=>e.code==='42501')
    await assert.rejects(f.call('authenticate',['content:publish']),(e:{code:string})=>e.code==='P0403')
  } finally { await f.db.close() }
})

async function fixture(limits: { bytes?: number; jobs?: number; concurrent?: number } = {}) {
  const db = new PGlite()
  await migrate({ query: async (sql, values) => values ? db.query(sql, values) : (await db.exec(sql)).at(-1) })
  const categories = (await db.query<{ id: string; slug: string }>('SELECT id::text,slug FROM catalog.categories ORDER BY id')).rows
  const category = categories[0].id
  const otherCategory = categories[1].id
  const agent = randomUUID()
  const key = newAgentCredential()
  await db.query(`INSERT INTO automation.agents(id,name,allowed_categories,upload_bytes_per_day,jobs_per_day,concurrent_jobs) VALUES($1,'fixture',$2,$3,$4,$5)`,
    [agent, [category], limits.bytes ?? 1024, limits.jobs ?? 10, limits.concurrent ?? 2])
  await db.query(`INSERT INTO automation.api_keys(id,agent_id,label,secret_hash,scopes,expires_at) VALUES($1,$2,'fixture',$3,ARRAY['catalog:read','uploads:write','content:create','content:edit'],now()+interval '1 day')`,
    [key.keyId, agent, key.tokenHash])
  await db.exec('SET ROLE pixinium_agent')
  const call = async <T = unknown>(name: string, args: unknown[] = [], credential = key) => {
    const params = [credential.keyId, credential.tokenHash, ...args]
    const result = await db.query<{ value: T }>(`SELECT automation.${name}(${params.map((_, i) => `$${i + 1}`).join(',')}) AS value`, params)
    return result.rows[0].value
  }
  const start = (id = randomUUID(), hash = agentPayloadHash({ body: 1 }), cat = category) => call<{ state: string; id: string; leaseToken: string; itemId: string; result?: { id: string } }>('start_job', [id, hash, cat])
  const upload = async () => {
    const path = `agents/${agent}/${randomUUID()}.png`
    await call('reserve_upload', [path, 32])
    return path
  }
  const document = (job: { itemId: string; leaseToken: string }, filename = 'cover.png') => ({
    slug: `fixture-${job.itemId}`, title: 'Fixture', summary: '', description: '', metadata: {}, facts: [], tags: [],
    accentColor: '#f1e5dd', attachments: [{ path: `${itemStorageDirectory(categories[0].slug, job.itemId, job.leaseToken)}/${filename}`,
      mediaType: 'image', mime: 'image/png', byteSize: 32, width: 1, height: 1, role: 'cover', altText: 'Fixture', focalX: 50, focalY: 50 }],
  })
  return { db, agent, key, category, otherCategory, call, start, upload, document }
}

test('machine runtime cannot read private tables, assume admin or call internal quota/auth helpers', async () => {
  const f = await fixture()
  try {
    const who = await f.call<{ id: string }>('authenticate', ['catalog:read'])
    assert.equal(who.id, f.agent)
    await assert.rejects(f.call('authenticate', ['catalog:read'], { ...f.key, tokenHash: 'f'.repeat(64) }), (e: { code: string }) => e.code === 'P0401')
    for (const relation of ['catalog.profiles', 'catalog.collections', 'catalog.items', 'automation.api_keys']) {
      await assert.rejects(f.db.query(`SELECT * FROM ${relation}`), (e: { code: string }) => e.code === '42501')
    }
    await assert.rejects(f.call('check_key', ['catalog:read']), (e: { code: string }) => e.code === '42501')
    const role = (await f.db.query<{ rolbypassrls: boolean }>('SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0]
    assert.equal(role.rolbypassrls, false)
    await assert.rejects(f.call('authenticate', ['admin:access']), (e: { code: string }) => e.code === 'P0403')
    const catalog = await f.call<{ categories: Array<{ id: string }> }>('catalog')
    assert.deepEqual(catalog.categories.map(c => c.id), [f.category])
    await assert.rejects(f.start(randomUUID(), undefined, f.otherCategory), (e: { code: string }) => e.code === 'P0403')
  } finally { await f.db.close() }
})

test('keys expire, revoke and restrict scopes independently from admin profiles', async () => {
  const f = await fixture()
  try {
    await f.db.exec('RESET ROLE')
    await f.db.query("UPDATE automation.api_keys SET scopes=ARRAY['uploads:write'] WHERE id=$1", [f.key.keyId])
    await f.db.exec('SET ROLE pixinium_agent')
    await assert.rejects(f.start(), (e: { code: string }) => e.code === 'P0403')
    await f.db.exec('RESET ROLE')
    await f.db.query('UPDATE automation.api_keys SET revoked_at=now() WHERE id=$1', [f.key.keyId])
    await f.db.exec('SET ROLE pixinium_agent')
    await assert.rejects(f.call('authenticate', ['content:create']), (e: { code: string }) => e.code === 'P0401')
    await f.db.exec('RESET ROLE')
    await f.db.query("UPDATE automation.api_keys SET revoked_at=NULL,created_at=now()-interval '2 days',expires_at=now()-interval '1 day' WHERE id=$1", [f.key.keyId])
    await f.db.exec('SET ROLE pixinium_agent')
    await assert.rejects(f.call('authenticate', ['content:create']), (e: { code: string }) => e.code === 'P0401')
  } finally { await f.db.close() }
})

test('upload quotas, staging ownership and active job claims are enforced in the database', async () => {
  const f = await fixture({ bytes: 64 })
  try {
    const path = await f.upload()
    await f.upload()
    await assert.rejects(f.upload(), (e: { code: string }) => e.code === 'P0429')
    await assert.rejects(f.call('reserve_upload', [`agents/${randomUUID()}/${randomUUID()}.png`, 1]), (e: { code: string }) => e.code === 'P0422')
    const job = await f.start()
    await f.call('claim_uploads', [job.id, job.leaseToken, [path]])
    await assert.rejects(f.call('discard_uploads', [[path]]), (e: { code: string }) => e.code === 'P0409')
    const other = await f.start()
    await assert.rejects(f.call('claim_uploads', [other.id, other.leaseToken, [path]]), (e: { code: string }) => e.code === 'P0403')
    await assert.rejects(f.call('discard_uploads', [[`${randomUUID()}/${randomUUID()}.png`]]), (e: { code: string }) => e.code === 'P0403')
  } finally { await f.db.close() }
})

test('request, job and concurrency quotas remain separate', async () => {
  const f = await fixture({ concurrent: 1, jobs: 1 })
  try {
    const job = await f.start()
    await assert.rejects(f.start(), (e: { code: string }) => e.code === 'P0429')
    await f.call('fail_job', [job.id, job.leaseToken])
    await assert.rejects(f.start(), (e: { code: string }) => e.code === 'P0429')
    await f.db.exec('RESET ROLE')
    await f.db.query('UPDATE automation.agents SET requests_per_minute=1 WHERE id=$1', [f.agent])
    await f.db.exec('SET ROLE pixinium_agent')
    await f.call('authenticate', ['catalog:read'])
    await assert.rejects(f.call('authenticate', ['catalog:read']), (e: { code: string }) => e.code === 'P0429')
  } finally { await f.db.close() }
})

test('agent submission stays private despite published input, replays a draft receipt, and only an admin can approve it', async () => {
  const f = await fixture()
  try {
    const request = randomUUID()
    const job = await f.start(request)
    assert.equal((await f.start(request)).state, 'processing')
    await assert.rejects(f.start(request, agentPayloadHash({ different: true })), (e: { code: string }) => e.code === 'P0409')
    const uploaded = await f.upload()
    await f.call('claim_uploads', [job.id, job.leaseToken, [uploaded]])
    const doc = { ...f.document(job), status: 'published', downloadSources: [{ provider: 'github', url: 'https://github.com/pixinium/archive' }] }
    const catalog = await f.call<{ downloadSources: Array<{ slug: string; priority: number }> }>('catalog')
    assert.equal(catalog.downloadSources.find(source => source.slug === 'github')?.priority, 1)
    const schema = (await f.call<{ metadata_schema_key: string }>('category', [f.category])).metadata_schema_key
    for (const path of [
      'profile/avatar/other.png',
      `agents/${f.agent}/items/${job.itemId}/${job.leaseToken}/cover.png`,
      doc.attachments[0].path.replace(/^[^/]+/, 'wrong-category'),
      doc.attachments[0].path.replace(`/${job.itemId}/`, '/999999/'),
      doc.attachments[0].path.replace(job.leaseToken, randomUUID()),
      doc.attachments[0].path.replace('/cover.png', '/../other.png'),
    ]) {
      await assert.rejects(f.call('publish_job', [job.id, job.leaseToken, schema, JSON.stringify({ ...doc, attachments: [{ ...doc.attachments[0], path }] }), 'assets']), (e: { code: string }) => e.code === 'P0403')
    }
    const result = await f.call<{ id: string; status: string; href?: string }>('publish_job', [job.id, job.leaseToken, schema, JSON.stringify(doc), 'assets'])
    assert.equal(result.id, job.itemId)
    assert.equal(result.status, 'draft')
    assert.equal(result.href, undefined)
    assert.equal((await f.start(request)).result?.id, job.itemId)
    await f.db.exec('RESET ROLE')
    assert.equal((await f.db.query('SELECT * FROM catalog.profiles')).rows.length, 0)
    assert.equal((await f.db.query('SELECT * FROM automation.item_origins')).rows.length, 1)
    assert.deepEqual((await f.db.query('SELECT source_slug,url FROM catalog.item_download_sources WHERE item_id=$1', [job.itemId])).rows,
      [{ source_slug: 'github', url: 'https://github.com/pixinium/archive' }])
    assert.equal((await f.db.query("SELECT * FROM automation.audit_events WHERE action='content_submitted'")).rows.length, 1)
    const saved = (await f.db.query<{ status: string; published_at: string | null }>('SELECT status,published_at FROM catalog.items WHERE id=$1', [job.itemId])).rows[0]
    assert.deepEqual(saved, { status: 'draft', published_at: null })
    assert.equal((await f.db.query(cardsQuery, [null, doc.slug, null])).rows.length, 0)
    const drafts = parseAdminCatalogFilters({ status: 'draft', q: 'Fixture' })
    const draftParams = adminCatalogParams(drafts)
    assert.equal((await f.db.query<{ total: number }>(adminCatalogCountQuery, draftParams)).rows[0].total, 1)
    assert.equal((await f.db.query(adminCatalogPageQuery, [...draftParams, 20, 0, ''])).rows.length, 1)
    assert.match(adminCatalogHref(drafts, 2), /status=draft/)
    assert.match(adminCatalogHref(drafts, 2), /page=2/)
    const admin = randomUUID(), member = randomUUID()
    await f.db.query("INSERT INTO catalog.profiles(id,role) VALUES($1,'admin'),($2,'member')", [admin, member])
    assert.equal((await f.db.query(setContentStatusQuery, [member, job.itemId, 'published'])).rows.length, 0)
    assert.equal((await f.db.query(setContentStatusQuery, [admin, job.itemId, 'published'])).rows.length, 1)
    assert.equal((await f.db.query(cardsQuery, [null, doc.slug, null])).rows.length, 1)
    assert.equal((await f.db.query(setContentStatusQuery, [admin, job.itemId, 'draft'])).rows.length, 1)
    assert.equal((await f.db.query(cardsQuery, [null, doc.slug, null])).rows.length, 0)
    assert.equal((await f.db.query<{ published_at: string | null }>('SELECT published_at FROM catalog.items WHERE id=$1', [job.itemId])).rows[0].published_at, null)
    await f.db.query("UPDATE catalog.categories SET is_active=false WHERE id=$1", [f.category])
    assert.equal((await f.db.query(setContentStatusQuery, [admin, job.itemId, 'published'])).rows.length, 0)
  } finally { await f.db.close() }
})

test('agent final paths follow the same category roots for images, music, games and assets', async () => {
  const f = await fixture()
  try {
    await f.db.exec('RESET ROLE')
    const categories = (await f.db.query<{ id: string; slug: string; metadata_schema_key: string }>(
      "SELECT id::text,slug,metadata_schema_key FROM catalog.categories WHERE slug IN ('images','music','games','assets') ORDER BY id")).rows
    assert.equal(categories.length, 4)
    await f.db.query('UPDATE automation.agents SET allowed_categories=$1 WHERE id=$2', [categories.map(c => c.id), f.agent])
    await f.db.exec('SET ROLE pixinium_agent')
    for (const category of categories) {
      const job = await f.start(randomUUID(), undefined, category.id)
      const doc = f.document(job)
      doc.attachments[0].path = `${itemStorageDirectory(category.slug, job.itemId, job.leaseToken)}/cover.png`
      const result = await f.call<{ id: string; status: string }>('publish_job', [job.id, job.leaseToken,
        category.metadata_schema_key, JSON.stringify(doc), 'assets'])
      assert.equal(result.id, job.itemId)
      assert.equal(result.status, 'draft')
    }
    await f.db.exec('RESET ROLE')
    const paths = (await f.db.query<{ object_path: string }>('SELECT object_path FROM catalog.assets ORDER BY id')).rows
    assert.deepEqual(paths.map(a => a.object_path.split('/')[0]), ['image', 'audio', 'game', 'assets'])
    assert.ok(paths.every(a => !a.object_path.startsWith('agents/')))
  } finally { await f.db.close() }
})

test('expired attempts are fenced and revocation is checked again at final publication', async () => {
  const f = await fixture()
  try {
    const request = randomUUID()
    const first = await f.start(request)
    await f.db.exec('RESET ROLE')
    await f.db.query("UPDATE automation.jobs SET lease_until=now()-interval '1 minute' WHERE id=$1", [first.id])
    await f.db.exec('SET ROLE pixinium_agent')
    const retry = await f.start(request)
    assert.equal(retry.itemId, first.itemId)
    assert.notEqual(retry.leaseToken, first.leaseToken)
    const schema = (await f.call<{ metadata_schema_key: string }>('category', [f.category])).metadata_schema_key
    await assert.rejects(f.call('publish_job', [first.id, first.leaseToken, schema, JSON.stringify(f.document(first)), 'assets']), (e: { code: string }) => e.code === 'P0409')
    await assert.rejects(f.call('publish_job', [retry.id, retry.leaseToken, schema, JSON.stringify(f.document(first)), 'assets']), (e: { code: string }) => e.code === 'P0403')
    await f.db.exec('RESET ROLE')
    await f.db.query('UPDATE automation.api_keys SET revoked_at=now() WHERE id=$1', [f.key.keyId])
    await f.db.exec('SET ROLE pixinium_agent')
    await assert.rejects(f.call('publish_job', [retry.id, retry.leaseToken, schema, JSON.stringify(f.document(retry)), 'assets']), (e: { code: string }) => e.code === 'P0401')
  } finally { await f.db.close() }
})

test('admin views filter before pagination and retain status/search/category/tag/sort in URLs', async () => {
  const f = await fixture()
  try {
    await f.db.exec('RESET ROLE')
    await f.db.query(`INSERT INTO catalog.items(category_id,slug,title,status,published_at)
      SELECT $1::bigint,'draft-'||n,'Draft '||n,'draft',NULL FROM generate_series(1,24) n`, [f.category])
    await f.db.query(`INSERT INTO catalog.items(category_id,slug,title,status,published_at)
      SELECT $1::bigint,'published-'||n,'Published '||n,'published',now() FROM generate_series(1,3) n`, [f.category])
    const filters = parseAdminCatalogFilters({ status: 'draft', q: 'Draft', sort: 'title' })
    const params = adminCatalogParams(filters)
    assert.equal((await f.db.query<{ total: number }>(adminCatalogCountQuery, params)).rows[0].total, 24)
    const first = (await f.db.query<{ id: string; status: string }>(adminCatalogPageQuery, [...params, 20, 0, 'title'])).rows
    const second = (await f.db.query<{ id: string }>(adminCatalogPageQuery, [...params, 20, 20, 'title'])).rows
    assert.equal(first.length, 20)
    assert.equal(second.length, 4)
    assert.ok(first.every(item => item.status === 'draft'))
    assert.ok(second.every(item => !first.some(other => item.id === other.id)))
    assert.equal((await f.db.query<{ total: number }>(adminCatalogCountQuery, adminCatalogParams(parseAdminCatalogFilters({})))).rows[0].total, 3)
    assert.equal((await f.db.query<{ total: number }>(adminCatalogCountQuery, adminCatalogParams(parseAdminCatalogFilters({ status: 'all' })))).rows[0].total, 27)
    const href = adminCatalogHref({ ...filters, category: 'images', tag: 'cozy night', tagMatch: 'any' }, 2)
    const url = new URL(href, 'https://pixinium.test')
    for (const [key, value] of Object.entries({ status: 'draft', q: 'Draft', category: 'images', tag: 'cozy night', match: 'any', sort: 'title', page: '2' })) assert.equal(url.searchParams.get(key), value)
    assert.ok(!adminCatalogHref({ ...filters, query: 'Changed' }).includes('page='))
  } finally { await f.db.close() }
})
