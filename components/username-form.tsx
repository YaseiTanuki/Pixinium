'use client'

import { useActionState, useEffect, useRef } from 'react'
import { ArrowRight, LoaderCircle } from 'lucide-react'
import { chooseUsername } from '@/app/actions/username'

export function UsernameForm() {
  const [state, action, pending] = useActionState(chooseUsername, {})
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (state.error) inputRef.current?.focus()
  }, [state])
  return <form action={action} className="account-form" aria-busy={pending}>
    <label>Username<input ref={inputRef} className="account-input" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={12} pattern="[a-zA-Z0-9_]{3,12}" placeholder="e.g. little_cloud…" aria-invalid={Boolean(state.error)} aria-describedby={`username-choice-help${state.error ? ' username-choice-error' : ''}`} readOnly={pending} />
      <span id="username-choice-help" className="account-help">3–12 letters, numbers or underscores. This name is yours to keep — you can’t change it later.</span>
    </label>
    <div aria-live="polite" className="empty:hidden">{state.error && <p id="username-choice-error" role="alert" className="account-notice">{state.error}</p>}</div>
    <button className="account-button w-full" disabled={pending}>{pending ? 'Saving your username…' : 'Save username'}{pending ? <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}</button>
  </form>
}
