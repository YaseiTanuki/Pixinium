'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { ArrowRight, LoaderCircle } from 'lucide-react'
import { login, signup } from '@/app/actions/auth'

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const registering = mode === 'signup'
  const [state, action, pending] = useActionState(registering ? signup : login, {})
  return <form action={action} className="account-form" aria-busy={pending}>
    {registering && <label className="block">Username<input className="account-input" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={12} pattern="[a-zA-Z0-9_]{3,12}" aria-describedby="username-help" /><span id="username-help" className="account-help">3-12 letters, numbers or underscores. Your username is permanent.</span></label>}
    <label className="block">Email<input className="account-input" name="email" type="email" autoComplete="email" spellCheck={false} autoCapitalize="none" required maxLength={254} /></label>
    <label className="block">Password<input className="account-input" name="password" type="password" autoComplete={registering ? 'new-password' : 'current-password'} aria-describedby={registering ? 'password-help' : undefined} required minLength={registering ? 12 : 1} maxLength={128} />{registering && <span id="password-help" className="account-help">Make it yours. Use at least 12 characters.</span>}</label>
    {registering && <label className="block">Confirm password<input className="account-input" name="confirmPassword" type="password" autoComplete="new-password" required maxLength={128} /></label>}
    <div aria-live="polite" className="empty:hidden">{state.error && <p role="alert" className="account-notice">{state.error}</p>}{state.message && <p className="account-notice account-notice-success">{state.message}</p>}</div>
    <button className="account-button w-full" disabled={pending}>{pending ? 'Please wait…' : registering ? 'Create account' : 'Sign in'}{pending ? <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}</button>
    <p className="account-form-footer">{registering ? 'Already have an account?' : 'New to Pixinium?'}{' '}<Link className="account-text-link" href={registering ? '/login' : '/register'}>{registering ? 'Sign in' : 'Create an account'}</Link></p>
  </form>
}
