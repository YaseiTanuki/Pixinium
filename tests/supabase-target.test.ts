import assert from 'node:assert/strict'
import test from 'node:test'
import { supabaseTarget } from '../scripts/supabase-target'

test('Supabase maintenance targeting pins project identity as well as shared pooler host', () => {
  const ref = 'bmwqepkgfcpodckitwbw'
  const host = 'aws-0-ap-southeast-1.pooler.supabase.com'
  const env = { SUPABASE_PROJECT_REF: ref, MIGRATION_TARGET_HOST: host,
    DATABASE_URL_UNPOOLED: `postgresql://postgres.${ref}:fixture@${host}:5432/postgres` }
  const target = supabaseTarget(env)
  const runtime = new URL(target.runtimeUrl('pixinium_runtime', 'fixture:@/secret'))
  assert.equal(runtime.username, `pixinium_runtime.${ref}`)
  assert.equal(decodeURIComponent(runtime.password), 'fixture:@/secret')
  assert.equal(runtime.searchParams.get('sslmode'), 'verify-full')
  assert.throws(() => supabaseTarget({ ...env, DATABASE_URL_UNPOOLED: env.DATABASE_URL_UNPOOLED.replace(ref, 'aaaaaaaaaaaaaaaaaaaa') }), /confirmed Supabase/)
  assert.throws(() => supabaseTarget({ ...env, DATABASE_URL_UNPOOLED: env.DATABASE_URL_UNPOOLED.replace('5432', '6543') }), /Session pooler/)
  assert.throws(() => supabaseTarget({ ...env, MIGRATION_TARGET_HOST: 'wrong.supabase.co' }), /confirmed Supabase/)
  assert.throws(() => supabaseTarget({}), /SUPABASE_PROJECT_REF/)
})
