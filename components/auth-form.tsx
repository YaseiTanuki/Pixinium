'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { ArrowRight, LoaderCircle } from 'lucide-react'
import { login, signup } from '@/app/actions/auth'
import { createClient } from '@/lib/supabase/client'

export function AuthForm({ mode, oauthError = false }: { mode: 'login' | 'signup'; oauthError?: boolean }) {
  const registering = mode === 'signup'
  const [state, action, pending] = useActionState(registering ? signup : login, {})
  const [googlePending, setGooglePending] = useState(false)
  const [googleError, setGoogleError] = useState(oauthError ? 'Google sign-in was cancelled or could not be completed. Please try again.' : '')

  async function signInWithGoogle() {
    setGooglePending(true)
    setGoogleError('')
    try {
      const { data, error } = await createClient().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error || !data.url) throw new Error('Google sign-in unavailable')
    } catch {
      setGoogleError('Unable to connect to Google sign-in. Please try again later.')
      setGooglePending(false)
    }
  }

  return <form action={action} className="account-form" aria-busy={pending || googlePending}>
    <button type="button" className="account-button w-full" disabled={pending || googlePending} onClick={signInWithGoogle}>
      {googlePending ? 'Connecting to Google…' : 'Continue with Google'}
      {googlePending && <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
    </button>
    <div aria-live="polite" className="empty:hidden">{googleError && <p role="alert" className="account-notice">{googleError}</p>}</div>
    <p className="account-form-footer">or continue with email</p>
    <fieldset disabled={googlePending} className="contents">
    <label className="block">Email<input className="account-input" name="email" type="email" autoComplete="email" spellCheck={false} autoCapitalize="none" required maxLength={254} /></label>
    <label className="block">Password<input className="account-input" name="password" type="password" autoComplete={registering ? 'new-password' : 'current-password'} aria-describedby={registering ? 'password-help' : undefined} required minLength={registering ? 12 : 1} maxLength={128} />{registering && <span id="password-help" className="account-help">Make it yours. Use at least 12 characters.</span>}</label>
    {registering && <label className="block">Confirm password<input className="account-input" name="confirmPassword" type="password" autoComplete="new-password" required maxLength={128} /></label>}
    <div aria-live="polite" className="empty:hidden">{state.error && <p role="alert" className="account-notice">{state.error}</p>}{state.message && <p className="account-notice account-notice-success">{state.message}</p>}</div>
    <button className="account-button w-full" disabled={pending}>{pending ? 'Please wait…' : registering ? 'Create account' : 'Sign in'}{pending ? <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}</button>
    <p className="account-form-footer">{registering ? 'Already have an account?' : 'New to Pixinium?'}{' '}<Link className="account-text-link" href={registering ? '/login' : '/register'}>{registering ? 'Sign in' : 'Create an account'}</Link></p>
    </fieldset>
  </form>
}
