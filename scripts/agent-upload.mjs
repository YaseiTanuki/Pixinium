import { readFile, stat } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'

// Usage: node --env-file=.env.agent.local scripts/agent-upload.mjs manifest.json
const base = process.env.AGENT_API_URL
const token = process.env.AGENT_API_TOKEN
if (!base || !token || !process.argv[2]) throw new Error('Set AGENT_API_URL and AGENT_API_TOKEN and pass a manifest path.')
const origin = new URL(base)
if (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname))) {
  throw new Error('Use HTTPS except for localhost development.')
}
async function api(path, method, body) {
  const response = await fetch(new URL(`/api/agent/${path}`, origin), {
    method, redirect: 'error', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || `API request failed (${response.status})`)
  return result
}

const manifestPath = resolve(process.argv[2])
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const { files = [], ...content } = manifest
const attachments = []
const staged = []
let submitting = false
try {
  for (const entry of files) {
    const path = resolve(dirname(manifestPath), entry.file)
    const info = await stat(path)
    if (!info.isFile() || info.size < 1 || info.size > 50 * 1024 * 1024) throw new Error('Files must be between 1 byte and 50 MiB.')
    const upload = await api('uploads', 'POST', { name: basename(path), size: info.size })
    staged.push(upload.path)
    const bytes = await readFile(path)
    if (bytes.length !== info.size) throw new Error('File changed while reading.')
    const uploaded = await fetch(upload.url, { method: 'PUT', redirect: 'error', headers: upload.headers, body: bytes })
    if (!uploaded.ok) throw new Error(`Storage upload failed (${uploaded.status})`)
    attachments.push({ path: upload.path, role: entry.role ?? 'download', fileName: basename(path), altText: entry.altText || basename(path) })
  }
  submitting = true
  const created = await api('content', 'POST', { ...content, attachments })
  console.log(JSON.stringify(created, null, 2))
} catch (error) {
  if (!submitting && staged.length) {
    try { await api('uploads', 'DELETE', staged) } catch { console.error('Temporary upload cleanup failed.') }
  }
  console.error(error instanceof Error ? error.message : 'Upload failed.')
  if (submitting) console.error('Creation may have completed. Check Admin Studio before retrying; this client does not retry creation automatically.')
  process.exitCode = 1
}
