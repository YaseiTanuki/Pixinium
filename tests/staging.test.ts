import { MAX_ATTACHMENT_COUNT } from '../lib/admin/limits'
import assert from 'node:assert/strict'
import test from 'node:test'
import { ownedStagingPaths } from '../lib/admin/staging'

const owner = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'
const path = `${owner}/${other}.png`
test('staging cleanup only accepts the verified owner temporary keys', () => {
  assert.deepEqual(ownedStagingPaths([path, path], owner), [path])
  for (const invalid of [[`${other}/${owner}.png`], [`content/${path}`], [`staging/${path}`], [`${owner}/../../published.png`], Array(MAX_ATTACHMENT_COUNT + 1).fill(path), 'all']) {
    assert.throws(() => ownedStagingPaths(invalid, owner))
  }
})
