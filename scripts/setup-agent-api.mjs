import { randomBytes, createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

const adminId = process.argv[2]
const url = process.argv[3] || 'http://localhost:3000'
if (!adminId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(adminId)) {
  throw new Error('Usage: node scripts/setup-agent-api.mjs <existing-admin-uuid> [app-url]')
}
const parsedUrl = new URL(url)
if (parsedUrl.protocol !== 'https:' && !(parsedUrl.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsedUrl.hostname))) throw new Error('Use HTTPS except for localhost.')
let env = await readFile('.env.local', 'utf8')
if (/^AGENT_API_(?:TOKEN_SHA256|ADMIN_ID)=.+/m.test(env)) throw new Error('Agent API is already configured. Remove its settings and .env.agent.local explicitly before rotating the token.')
const token = randomBytes(32).toString('base64url')
const hash = createHash('sha256').update(token).digest('hex')
await writeFile('.env.agent.local', `AGENT_API_URL=${parsedUrl.origin}\nAGENT_API_TOKEN=${token}\n`, { flag: 'wx', mode: 0o600 })
env = env.replace(/^AGENT_API_(?:TOKEN_SHA256|ADMIN_ID)=.*\r?\n?/gm, '')
await writeFile('.env.local', `${env.trimEnd()}\n\nAGENT_API_TOKEN_SHA256=${hash}\nAGENT_API_ADMIN_ID=${adminId}\n`)
console.log('Agent API configured. Client credentials saved in gitignored .env.agent.local. Restart the app; keep that file private.')
