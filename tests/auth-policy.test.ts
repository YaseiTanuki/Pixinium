import assert from 'node:assert/strict'
import test from 'node:test'
import { hasPermission } from '../lib/auth/permissions'
import { loginSchema, signupSchema, usernameSchema } from '../lib/auth/validation'
import { imageFormat } from '../lib/auth/upload-validation'
import { authDiagnostic, loginErrorMessage, signupErrorMessage } from '../lib/auth/errors'

test('signup diagnostics omit private provider details and classify actionable failures', () => {
  const failure = { code: 'unexpected_failure', status: 500,
    message: 'Error sending confirmation email to private@example.com', token: 'secret' }
  assert.deepEqual(authDiagnostic(failure), { code: 'unexpected_failure', status: 500, category: 'email_delivery' })
  assert.match(signupErrorMessage(failure), /confirmation email/)
  assert.match(signupErrorMessage({ status: 429 }), /wait/)
  assert.match(signupErrorMessage({ code: 'email_address_not_authorized' }), /confirmation email/)
  assert.match(signupErrorMessage({ code: 'request_timeout' }), /inbox/)
  assert.equal(signupErrorMessage({ code: 'user_already_exists' }), signupErrorMessage({ code: 'unknown' }))
  assert.equal(authDiagnostic({ code: 'private@example.com' }).code, 'unknown')
})

test('network diagnostics retain only allowed transport codes and login errors conceal account existence', () => {
  const failure = { message: 'fetch failed', cause: { code: 'ENOTFOUND', hostname: 'private.internal' } }
  assert.deepEqual(authDiagnostic(failure), { code: 'unknown', status: undefined, category: 'network', transport: 'ENOTFOUND' })
  assert.match(loginErrorMessage(failure), /reach/)
  assert.match(signupErrorMessage(failure), /reach/)
  assert.match(loginErrorMessage({ status: 429 }), /wait/)
  assert.equal(loginErrorMessage({ code: 'invalid_credentials' }), loginErrorMessage({ code: 'email_not_confirmed' }))
  assert.equal('transport' in authDiagnostic({ cause: { code: 'secret-value' } }), false)
})

test('only admin receives v1 upload and admin access permissions', () => {
  for (const role of ['member', 'user', 'editor', '', 'Admin', 'owner', '__proto__', 'constructor']) {
    assert.equal(hasPermission(role, 'admin:access'), false)
    assert.equal(hasPermission(role, 'assets:upload'), false)
  }
  assert.equal(hasPermission('admin', 'assets:upload'), true)
  assert.equal(hasPermission('admin', 'admin:access'), true)
})

test('registration strips supplied roles and IDs, validates confirmation, preserves password spaces', () => {
  const input = { email: 'member@example.test', password: ' long password ',
    confirmPassword: ' long password ', username: 'member', role: 'admin', id: 'attacker' }
  const parsed = signupSchema.parse(input)
  assert.equal('role' in parsed, false)
  assert.equal('id' in parsed, false)
  assert.equal('username' in parsed, false)
  assert.equal(parsed.password, input.password)
  assert.equal(signupSchema.safeParse({ email: input.email, password: input.password, confirmPassword: input.password }).success, true)
  assert.equal(signupSchema.safeParse({ ...input, confirmPassword: 'different' }).success, false)
  assert.equal(signupSchema.safeParse({ ...input, password: 'short', confirmPassword: 'short' }).success, false)
  assert.equal(loginSchema.safeParse({ email: input.email, password: 'x'.repeat(129) }).success, false)
})

test('upload rejects active documents and truncated files, recognizes supported signatures', () => {
  assert.equal(imageFormat(new TextEncoder().encode('<svg onload="alert(1)"></svg>')), null)
  assert.equal(imageFormat(new Uint8Array([0xff, 0xd8, 0xff])), null)
  assert.equal(imageFormat(new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]))?.mime, 'image/png')
  assert.equal(imageFormat(new Uint8Array([255,216,255,0,0,0,0,0,0,0,0,0]))?.mime, 'image/jpeg')
  assert.equal(imageFormat(new TextEncoder().encode('RIFF0000WEBP'))?.mime, 'image/webp')
})


test('usernames normalize case and enforce the permanent username format', () => {
  assert.equal(usernameSchema.parse(' Member_12 '), 'member_12')
  assert.equal(usernameSchema.safeParse('a'.repeat(12)).success, true)
  for (const name of ['ab', 'a'.repeat(13), 'has spaces', 'name!', '']) {
    assert.equal(usernameSchema.safeParse(name).success, false)
  }
})
