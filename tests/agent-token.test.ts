import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { verifyAgentToken } from '../lib/auth/agent-token'

test('agent API requires the exact bearer secret and fails closed on invalid configuration', () => {
  const token = 'test-only-token-'.repeat(4)
  const hash = createHash('sha256').update(token).digest('hex')
  assert.equal(verifyAgentToken(`Bearer ${token}`, hash), true)
  for (const header of [null, '', token, `Basic ${token}`, `Bearer ${token}wrong`, 'Bearer short', `Bearer ${token}\n`, `Bearer ${'a'.repeat(257)}`]) {
    assert.equal(verifyAgentToken(header, hash), false)
  }
  for (const invalid of ['', 'invalid', 'a'.repeat(63), 'z'.repeat(64)]) {
    assert.equal(verifyAgentToken(`Bearer ${token}`, invalid), false)
  }
})
