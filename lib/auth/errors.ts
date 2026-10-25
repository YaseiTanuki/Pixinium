// Never serialize provider error messages: they can contain emails or internal SQL.
export function authDiagnostic(error: unknown) {
  const value = error && typeof error === 'object' ? error as Record<string, unknown> : {}
  const code = typeof value.code === 'string' && /^[a-zA-Z0-9_]{1,64}$/.test(value.code)
    ? value.code : 'unknown'
  const status = typeof value.status === 'number' ? value.status : undefined
  const message = typeof value.message === 'string' ? value.message : ''
  const cause = value.cause && typeof value.cause === 'object' ? value.cause as Record<string, unknown> : {}
  const transport = typeof cause.code === 'string' &&
    ['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'].includes(cause.code)
    ? cause.code : undefined
  const category = /sending (confirmation )?email/i.test(message) ? 'email_delivery'
    : /database error/i.test(message) ? 'database'
    : /timeout|timed out/i.test(message) ? 'timeout'
    : transport || /fetch failed|network request failed/i.test(message) ? 'network' : 'provider'
  return { code, status, category, ...(transport ? { transport } : {}) }
}

export function loginErrorMessage(error: unknown): string {
  const { code, status, category } = authDiagnostic(error)
  if (status === 429 || code === 'over_request_rate_limit') {
    return 'Too many sign-in attempts. Please wait a few minutes before trying again.'
  }
  if (category === 'network' || category === 'timeout' || code === 'request_timeout') {
    return 'We could not reach the sign-in service. Please try again in a moment.'
  }
  return 'Unable to sign in. Check your credentials and confirm your email, or try again later.'
}

export function signupErrorMessage(error: unknown): string {
  const { code, status, category } = authDiagnostic(error)
  if (category === 'network') return 'We could not reach the registration service. Please try again in a moment.'
  if (code === 'email_address_not_authorized' || category === 'email_delivery') {
    return 'We could not send the confirmation email. Please contact support or try again later.'
  }
  if (status === 429 || code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') {
    return 'Too many registration attempts. Please wait a few minutes before trying again.'
  }
  if (code === 'weak_password') return 'Choose a stronger password with at least 12 characters.'
  if (code === 'email_address_invalid') return 'Please enter a valid email address that can receive mail.'
  if (code === 'signup_disabled' || code === 'email_provider_disabled') {
    return 'Email registration is currently unavailable. Please try again later.'
  }
  if (code === 'request_timeout' || category === 'timeout') {
    return 'Registration took too long. Check your inbox before trying again.'
  }
  return 'Unable to create an account. Please try again later or sign in if you already have an account.'
}
