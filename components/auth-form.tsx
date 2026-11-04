'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { ArrowRight, LoaderCircle } from 'lucide-react'
import { login, signup } from '@/app/actions/auth'
import { createClient } from '@/lib/supabase/client'

export function AuthForm({ mode, oauthError = false }: { mode: 'login' | 'signup'; oauthError?: boolean }) {
  const registering = mode === 'signup'
  const [state, action, pending] = useActionState(registering ? signup : login, {})
  const [oauthProvider, setOauthProvider] = useState<'google' | 'github' | null>(null)
  const oauthPending = oauthProvider !== null
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [providerError, setProviderError] = useState(oauthError ? 'Sign-in was cancelled or could not be completed. Please try again.' : '')

  async function signInWithProvider(provider: 'google' | 'github') {
    if (pending || oauthPending || (registering && !termsAccepted)) return
    const providerName = provider === 'google' ? 'Google' : 'GitHub'
    setOauthProvider(provider)
    setProviderError('')
    try {
      const { data, error } = await createClient().auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error || !data.url) throw new Error('Sign-in unavailable')
    } catch {
      setProviderError(`Unable to connect to ${providerName} sign-in. Please try again later.`)
      setOauthProvider(null)
    }
  }

  return <form action={action} className="account-form" aria-busy={pending || oauthPending}>
    <fieldset disabled={oauthPending} className="contents">
    <label className="block">Email<input className="account-input" name="email" type="email" autoComplete="email" spellCheck={false} autoCapitalize="none" required maxLength={254} /></label>
    <label className="block">Password<input className="account-input" name="password" type="password" autoComplete={registering ? 'new-password' : 'current-password'} aria-describedby={registering ? 'password-help' : undefined} required minLength={registering ? 12 : 1} maxLength={128} />{registering && <span id="password-help" className="account-help">Make it yours. Use at least 12 characters.</span>}</label>
    {!registering && <p className="account-form-footer text-right"><Link className="account-text-link" href="/forgot-password">Forgot password?</Link></p>}
    {registering && <label className="block">Confirm password<input className="account-input" name="confirmPassword" type="password" autoComplete="new-password" required maxLength={128} /></label>}
    <div aria-live="polite" className="empty:hidden">{state.error && <p role="alert" className="account-notice">{state.error}</p>}{state.message && <p className="account-notice account-notice-success">{state.message}</p>}</div>
    {registering && <label className="account-policy-notice account-policy-consent">
      <input className="mt-1 size-4 shrink-0 accent-[#ad3434]" type="checkbox" name="termsAccepted" value="yes" required checked={termsAccepted} onChange={event => setTermsAccepted(event.target.checked)} disabled={pending || oauthPending} />
      <span>I agree to the <Link href="/policies/terms">Terms of Service</Link> and acknowledge the <Link href="/policies/privacy">Privacy Policy</Link>, including when creating an account with Google or GitHub.</span>
    </label>}
    <button className="account-button w-full" disabled={pending || (registering && !termsAccepted)}>{pending ? 'Please wait…' : registering ? 'Create account' : 'Sign in'}{pending ? <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}</button>
    </fieldset>
    <div className="account-auth-alternatives">
      <p className="account-auth-divider">or continue with</p>
      <div className="account-auth-options" role="group" aria-label="Other sign-in options">
        <button type="button" className="account-auth-option" aria-label={oauthProvider === 'google' ? 'Connecting to Google' : 'Continue with Google'} title="Continue with Google" disabled={pending || oauthPending || (registering && !termsAccepted)} onClick={() => signInWithProvider('google')}>
          {oauthProvider === 'google' ? <LoaderCircle size={20} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z" />
            <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z" />
            <path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.07a10 10 0 0 0 0 9.02l3.34-2.59Z" />
            <path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.82 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59A5.99 5.99 0 0 1 12 5.96Z" />
          </svg>}
        </button>
        <button type="button" className="account-auth-option" aria-label={oauthProvider === 'github' ? 'Connecting to GitHub' : 'Continue with GitHub'} title="Continue with GitHub" disabled={pending || oauthPending || (registering && !termsAccepted)} onClick={() => signInWithProvider('github')}>
          {oauthProvider === 'github' ? <LoaderCircle size={20} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .3a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.23c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.33-1.76-1.33-1.76-1.09-.74.08-.73.08-.73 1.21.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49.99.11-.78.42-1.3.76-1.6-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.81 1.1.81 2.22v3.3c0 .32.22.7.83.58A12 12 0 0 0 12 .3Z" /></svg>}
        </button>
      </div>
    </div>
    <div aria-live="polite" className="empty:hidden">{providerError && <p role="alert" className="account-notice">{providerError}</p>}</div>
    <p className="account-form-footer">{registering ? 'Already have an account?' : 'New to Pixinium?'}{' '}<Link className="account-text-link" href={registering ? '/login' : '/register'}>{registering ? 'Sign in' : 'Create an account'}</Link></p>
  </form>
}
