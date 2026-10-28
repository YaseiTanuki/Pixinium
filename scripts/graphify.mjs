import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const python = path.join(root, '.tools', 'graphify', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
if (!existsSync(python)) {
  console.error('Graphify is not installed. Follow docs/graphify.md to set up the local Python environment.')
  process.exit(1)
}
const result = spawnSync(python, ['-m', 'graphify', ...process.argv.slice(2)], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, PYTHONUTF8: '1' },
})
if (result.error) console.error(result.error.message)
process.exit(result.status ?? 1)
