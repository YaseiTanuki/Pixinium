'use client'

import { useActionState } from 'react'
import { chooseUsername } from '@/app/actions/username'

export function UsernameForm() {
  const [state, action, pending] = useActionState(chooseUsername, {})
  return <form action={action} className="account-form" aria-busy={pending}>
    <label>Choose your username<input className="account-input" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={12} pattern="[a-zA-Z0-9_]{3,12}" aria-describedby="username-choice-help" /></label>
    <p id="username-choice-help" className="account-help">Choose an available name with 3-12 letters, numbers or underscores. Once saved, it cannot be changed.</p>
    <div aria-live="polite">{state.error && <p role="alert" className="account-notice">{state.error}</p>}{state.message && <p>{state.message}</p>}</div>
    <button className="account-button" disabled={pending}>{pending ? 'Saving...' : 'Save permanent username'}</button>
  </form>
}
