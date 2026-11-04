import test from 'node:test'
import assert from 'node:assert/strict'
import { newAgentCredential, parseAgentCredential } from '../lib/agent-identity'

test('agent API parses only independently identified credentials', () => {
  const { token, keyId, tokenHash } = newAgentCredential()
  assert.deepEqual(parseAgentCredential(`Bearer ${token}`), { keyId, tokenHash })
  for (const header of [null, '', token, `Basic ${token}`, `Bearer ${token}wrong`, 'Bearer short', `Bearer ${token}\n`, `Bearer ${'a'.repeat(257)}`]) {
    assert.equal(parseAgentCredential(header), null)
  }
})
