import assert from 'node:assert/strict'
import test from 'node:test'
import { databaseTlsConfig } from '../lib/database-tls'

test('Supabase TLS pins the CA and verifies hostname despite URL SSL overrides', () => {
  const config = databaseTlsConfig('postgresql://fixture:fixture@db.bmwqepkgfcpodckitwbw.supabase.co:5432/postgres?sslmode=disable&sslrootcert=untrusted')
  assert.equal(config.ssl?.rejectUnauthorized, true)
  assert.equal(config.ssl?.servername, 'db.bmwqepkgfcpodckitwbw.supabase.co')
  assert.match(config.ssl!.ca, /BEGIN CERTIFICATE/)
  assert.equal(new URL(config.connectionString).search, '')
})

test('Hyperdrive and local connections retain their original settings', () => {
  const connection = 'postgresql://fixture:fixture@localhost:5432/postgres?sslmode=disable'
  assert.deepEqual(databaseTlsConfig(connection), { connectionString: connection })
})
