'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { ArrowRight, LoaderCircle } from 'lucide-react'
import { forgotPassword, resetPassword } from '@/app/actions/password'

export function PasswordForm({ mode }: { mode: 'forgot' | 'reset' }) {
  const resetting = mode === 'reset'
  const [state, action, pending] = useActionState(resetting ? resetPassword : forgotPassword, {})

  return <form action={action} className="account-form" aria-busy={pending}>
    {!state.message && <>
      <fieldset disabled={pending} className="contents">
        {resetting ? <>
          <label className="block">New password<input className="account-input" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} aria-describedby="reset-password-help" /><span id="reset-password-help" className="account-help">Use at least 12 characters.</span></label>
          <label className="block">Confirm new password<input className="account-input" name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
        </> : <label className="block">Email<input className="account-input" name="email" type="email" autoComplete="email" spellCheck={false} autoCapitalize="none" required maxLength={254} /></label>}
        <button className="account-button w-full" disabled={pending}>{pending ? 'Please wait…' : resetting ? 'Save new password' : 'Send reset link'}{pending ? <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}</button>
      </fieldset>
    </>}
    <div aria-live="polite" className="empty:hidden">{state.error && <p role="alert" className="account-notice">{state.error}</p>}{state.message && <p role="status" className="account-notice account-notice-success">{state.message}</p>}</div>
    <p className="account-form-footer"><Link className="account-text-link" href={resetting && state.message ? '/profile' : '/login'}>{resetting && state.message ? 'Continue to your profile' : 'Back to sign in'}</Link></p>
  </form>
}
