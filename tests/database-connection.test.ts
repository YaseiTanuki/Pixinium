import assert from 'node:assert/strict'
import test from 'node:test'
import { connectionForRole } from '../lib/database-connection'

test('optional Workers database pools keep read, writer and agent credentials separate', () => {
  const urls = { DATABASE_URL: 'reader', CATALOG_ADMIN_DATABASE_URL: 'writer', AGENT_DATABASE_URL: 'agent' }
  const bindings = { DATABASE_POOL: { connectionString: 'read-pool' }, CATALOG_ADMIN_POOL: { connectionString: 'write-pool' },
    AGENT_POOL: { connectionString: 'agent-pool' } }
  assert.equal(connectionForRole('reader', urls, bindings), 'read-pool')
  assert.equal(connectionForRole('writer', urls, bindings), 'write-pool')
  assert.equal(connectionForRole('agent', urls, bindings), 'agent-pool')
  assert.equal(connectionForRole('maintenance', urls, bindings), 'maintenance')
  assert.equal(connectionForRole('agent', urls, { DATABASE_POOL: bindings.DATABASE_POOL }), 'agent')
})
