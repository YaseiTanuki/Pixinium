import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import ts from 'typescript'
import { POLICIES } from '../lib/policies'

test('bundled policy documents and share icon work with no repository assets on disk', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pixinium-bundled-assets-'))
  try {
    const source = await readFile(new URL('../lib/generated/site-assets.ts', import.meta.url), 'utf8')
    const icon = await readFile(new URL('../public/brand/pixinium-apple-icon.png', import.meta.url))
    await writeFile(join(directory, 'assets.cjs'), ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText)
    const child = spawnSync(process.execPath, ['-e', `
      const { POLICY_SOURCES, SHARE_IMAGE_ICON } = require('./assets.cjs');
      const fs = require('node:fs');
      if (fs.existsSync('content') || fs.existsSync('public')) process.exit(1);
      console.log(JSON.stringify({ policies: Object.keys(POLICY_SOURCES),
        copyright: POLICY_SOURCES.copyright, icon: SHARE_IMAGE_ICON }));
    `], { cwd: directory, encoding: 'utf8' })
    assert.equal(child.status, 0, child.stderr)
    const result = JSON.parse(child.stdout)
    assert.deepEqual(result.policies.sort(), POLICIES.map(policy => policy.slug).sort())
    assert.match(result.copyright, /copyright/i)
    assert.deepEqual(Buffer.from(result.icon.split(',')[1], 'base64'), icon)
  } finally { await rm(directory, { recursive: true, force: true }) }
})
