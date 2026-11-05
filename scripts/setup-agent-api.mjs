import { randomBytes, randomUUID, createHash } from 'node:crypto'
import { readFile, writeFile, copyFile, mkdir, constants } from 'node:fs/promises'
import { resolve, relative, dirname } from 'node:path'
import { parse } from 'dotenv'
import { neon } from '@neondatabase/serverless'

const [command, subject, ...rest] = process.argv.slice(2)
const flags = Object.fromEntries(rest.map((arg, i) => arg.startsWith('--') ? [arg.slice(2), rest[i + 1]] : null).filter(Boolean))
const scopesAllowed = ['catalog:read', 'uploads:write', 'content:create', 'content:publish']
const adminUrl = process.env.AGENT_MIGRATION_DATABASE_URL || process.env.DATABASE_URL_UNPOOLED
if (!adminUrl) throw new Error('Load a server environment with DATABASE_URL_UNPOOLED. Never run this on the agent machine.')
const sql = neon(adminUrl)
const uuid = value => /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value || '')
const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
async function backup(file) {
  try { await copyFile(file, file.replace(/\.local$/, `.${timestamp}.backup.local`), constants.COPYFILE_EXCL) }
  catch (error) { if (error.code !== 'ENOENT') throw error }
}
async function saveCredentials(token) {
  const output = resolve(flags.output || 'local/pixinium-agent/.env.local')
  const rel = relative(process.cwd(), output)
  if (rel.startsWith('..') || resolve(output) === process.cwd()) throw new Error('Credential output must be a file inside this workspace.')
  const url = new URL(flags.url || process.env.AGENT_API_URL || 'http://localhost:3000')
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('Use HTTPS outside localhost.')
  await mkdir(dirname(output), { recursive: true })
  await backup(output)
  await writeFile(output, `AGENT_API_URL=${url.origin}\nAGENT_API_TOKEN=${token}\n`, { mode: 0o600 })
  console.log('Secret written to:', rel, '(not displayed; keep this file private)')
}
try {
  if (command === 'configure-runtime') {
    const env = await readFile('.env.local', 'utf8')
    const current = parse(env)
    if (current.AGENT_DATABASE_URL) throw new Error('Agent runtime is already configured. Use key create/rotate/revoke commands instead.')
    const runtime = new URL(current.DATABASE_URL || adminUrl)
    if (runtime.hostname.replace('-pooler', '') !== new URL(adminUrl).hostname.replace('-pooler', '')) throw new Error('Runtime and migration endpoints must match.')
    if ((await sql`SELECT 1 FROM pg_roles WHERE rolname='pixinium_agent_api'`).length) throw new Error('Runtime login already exists; recover its secret instead of silently resetting it.')
    const password = randomBytes(32).toString('hex')
    runtime.username = 'pixinium_agent_api'
    runtime.password = password
    const recoveryFile = `.env.agent-runtime.recovery.${timestamp}.local`
    await writeFile(recoveryFile, `AGENT_DATABASE_URL=${runtime.href}\n`, { flag: 'wx', mode: 0o600 })
    // Password is generated hex, not operator input. DDL does not accept bind parameters here.
    await sql.transaction([
      sql.query(`CREATE ROLE pixinium_agent_api LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOBYPASSRLS`),
      sql.query('GRANT pixinium_agent TO pixinium_agent_api'),
      sql.query("ALTER ROLE pixinium_agent_api SET statement_timeout='30s'"),
    ])
    await backup('.env.local')
    const cleaned = env.replace(/^AGENT_API_(?:TOKEN_SHA256|ADMIN_ID)=.*\r?\n?/gm, '')
    await writeFile('.env.local', `${cleaned.trimEnd()}\nAGENT_DATABASE_URL=${runtime.href}\n`, { mode: 0o600 })
    console.log('Restricted agent runtime configured. Legacy admin-bound credentials are disabled. Restart the app.')
  } else if (command === 'create' || command === 'rotate') {
    if (command === 'rotate' && !uuid(subject)) throw new Error('Rotate needs an agent UUID.')
    const previous = command === 'rotate'
      ? (await sql`SELECT scopes FROM automation.api_keys WHERE agent_id=${subject}::uuid ORDER BY created_at DESC LIMIT 1`)[0] : null
    if (command === 'rotate' && !previous) throw new Error('Agent has no key to rotate.')
    const scopes = (flags.scopes || (previous?.scopes || scopesAllowed).join(',')).split(',')
    if (scopes.some(scope => !scopesAllowed.includes(scope)) || new Set(scopes).size !== scopes.length) throw new Error('Invalid scopes.')
    const days = Number(flags.days || 90)
    if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error('Expiry must be 1–365 days.')
    let agentId = subject
    let categories
    if (command === 'create') {
      if (!subject || subject.length > 100 || !flags.categories) throw new Error('Usage: create <name> --categories images,music,games,assets [--url https://pixinium.com]')
      categories = await sql`SELECT id::text,slug FROM catalog.categories WHERE is_active AND slug=ANY(${flags.categories.split(',')}::text[])`
      if (categories.length !== new Set(flags.categories.split(',')).size) throw new Error('One or more categories are unavailable.')
      agentId = randomUUID()
    } else if (!uuid(agentId)) throw new Error('Rotate needs an agent UUID.')
    const keyId = randomUUID()
    const secret = randomBytes(32).toString('base64url')
    const digest = createHash('sha256').update(secret).digest('hex')
    const token = `pxa_${keyId}_${secret}`
    const statements = []
    if (command === 'create') statements.push(sql`INSERT INTO automation.agents(id,name,allowed_categories) VALUES(${agentId}::uuid,${subject},${categories.map(c => c.id)}::bigint[])`)
    statements.push(sql`INSERT INTO automation.api_keys(id,agent_id,label,secret_hash,scopes,expires_at) VALUES(${keyId}::uuid,${agentId}::uuid,${flags.label || command},${digest},${scopes}::text[],now()+${days}*interval '1 day')`)
    statements.push(sql`INSERT INTO automation.audit_events(agent_id,key_id,action) VALUES(${agentId}::uuid,${keyId}::uuid,'key_created')`)
    await sql.transaction(statements)
    await saveCredentials(token)
    console.log(JSON.stringify({ agentId, keyId, scopes, expiresInDays: days }))
    if (command === 'rotate') console.log('Old keys remain active until explicitly revoked, allowing a controlled client cutover.')
  } else if (command === 'revoke') {
    if (!uuid(subject)) throw new Error('Revoke needs a key UUID.')
    const rows = await sql`WITH key AS(UPDATE automation.api_keys SET revoked_at=coalesce(revoked_at,now()) WHERE id=${subject}::uuid RETURNING id,agent_id)
      INSERT INTO automation.audit_events(agent_id,key_id,action) SELECT agent_id,id,'key_revoked' FROM key RETURNING key_id`
    console.log(rows.length ? 'Key revoked for subsequent API operations.' : 'Key not found.')
  } else if (command === 'disable') {
    if (!uuid(subject)) throw new Error('Disable needs an agent UUID.')
    await sql`WITH disabled AS(UPDATE automation.agents SET active=false WHERE id=${subject}::uuid RETURNING id)
      INSERT INTO automation.audit_events(agent_id,action) SELECT id,'agent_disabled' FROM disabled`
    console.log('Agent disabled for subsequent API operations.')
  } else if (command === 'status') {
    console.log(JSON.stringify(await sql`SELECT a.id,a.name,a.active,a.allowed_categories,k.id AS key_id,k.label,k.scopes,k.expires_at,k.revoked_at,k.last_used_at
      FROM automation.agents a LEFT JOIN automation.api_keys k ON k.agent_id=a.id ORDER BY a.created_at,k.created_at`, null, 2))
  } else throw new Error('Commands: configure-runtime, create <name>, rotate <agent-id>, revoke <key-id>, disable <agent-id>, status.')
} catch (error) {
  console.error('Agent management failed:', error.code || (error.name === 'Error' ? error.message : error.name))
  process.exitCode = 1
}
