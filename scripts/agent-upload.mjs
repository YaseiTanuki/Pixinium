import { readFile, writeFile, stat } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'

const base = process.env.AGENT_API_URL
const token = process.env.AGENT_API_TOKEN
if (!base || !token || !process.argv[2]) throw new Error('Load .env.agent.local and pass a manifest path.')
const origin = new URL(base)
if (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname))) throw new Error('Use HTTPS outside localhost.')
const manifestPath = resolve(process.argv[2])
const checkpointPath = `${manifestPath}.agent-state.json`
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const { files = [], ...content } = manifest
const fingerprints = await Promise.all(files.map(async entry => {
  const path = resolve(dirname(manifestPath), entry.file)
  const info = await stat(path)
  if (!info.isFile() || info.size < 1 || info.size > 50 * 1024 * 1024) throw new Error('Files must be 1 byte–50 MiB.')
  return { size: info.size, mtime: info.mtimeMs }
}))
const fingerprint = createHash('sha256').update(JSON.stringify({ manifest, fingerprints })).digest('hex')
let state = { fingerprint, idempotencyKey: randomUUID(), attachments: [] }
try { state = JSON.parse(await readFile(checkpointPath, 'utf8')) }
catch (error) { if (error.code !== 'ENOENT') throw error }
if (state.fingerprint !== fingerprint) throw new Error('Manifest/files changed. Keep the old checkpoint for its job; use a new manifest path for a new upload.')
const save = () => writeFile(checkpointPath, JSON.stringify(state, null, 2), { mode: 0o600 })
async function api(path, method, body, idempotencyKey) {
  const response = await fetch(new URL(`/api/agent/${path}`, origin), {
    method, redirect: 'error', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || `API request failed (${response.status})`)
  return { status: response.status, result }
}
try {
  if (!state.payload) {
    for (let index = state.attachments.length; index < files.length; index++) {
      const entry = files[index]
      const path = resolve(dirname(manifestPath), entry.file)
      const bytes = await readFile(path)
      if (bytes.length !== fingerprints[index].size) throw new Error('File changed while reading.')
      const { result: upload } = await api('uploads', 'POST', { name: basename(path), size: bytes.length })
      const uploaded = await fetch(upload.url, { method: 'PUT', redirect: 'error', headers: upload.headers, body: bytes })
      if (!uploaded.ok) throw new Error(`Storage upload failed (${uploaded.status})`)
      state.attachments.push({ path: upload.path, role: entry.role ?? 'download', fileName: basename(path), altText: entry.altText || basename(path) })
      await save()
    }
    state.payload = { ...content, attachments: state.attachments }
    await save()
  }
  for (let attempt = 0; attempt < 60; attempt++) {
    const { status, result } = await api('content', 'POST', state.payload, state.idempotencyKey)
    if (status === 202) { await new Promise(resolve => setTimeout(resolve, 5000)); continue }
    state.result = result
    await save()
    console.log(JSON.stringify(result, null, 2))
    process.exit(0)
  }
  throw new Error('Job is still running. Rerun this same command to resume.')
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Upload failed.')
  console.error('Checkpoint retained. Rerun the same manifest to resume with the same idempotency key and staged files.')
  process.exitCode = 1
}
