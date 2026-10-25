'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { loginSchema, signupSchema, type AuthState } from '@/lib/auth/validation'
import { authDiagnostic, loginErrorMessage, signupErrorMessage } from '@/lib/auth/errors'

export async function login(_state: AuthState, form: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(form))
  if (!parsed.success) return { error: 'Enter a valid email and password.' }
  const startedAt = Date.now()
  try {
    const client = await createClient()
    const { error } = await client.auth.signInWithPassword(parsed.data)
    if (error) {
      console.error('[auth.login]', { ...authDiagnostic(error), elapsedMs: Date.now() - startedAt })
      return { error: loginErrorMessage(error) }
    }
  } catch (error) {
    console.error('[auth.login]', { ...authDiagnostic(error), elapsedMs: Date.now() - startedAt })
    return { error: loginErrorMessage(error) }
  }
  revalidatePath('/', 'layout')
  redirect('/profile')
}

export async function signup(_state: AuthState, form: FormData): Promise<AuthState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(form))
  if (!parsed.success) return { error: 'Use a valid email, a name of 2–100 characters, and matching passwords of 12–128 characters.' }
  let signedIn = false
  const startedAt = Date.now()
  try {
    const client = await createClient()
    const { email, password, displayName } = parsed.data
    const { data, error } = await client.auth.signUp({ email, password,
      options: { data: { display_name: displayName } } })
    if (error) {
      console.error('[auth.signup]', { ...authDiagnostic(error), elapsedMs: Date.now() - startedAt })
      return { error: signupErrorMessage(error) }
    }
    signedIn = Boolean(data.session)
  } catch (error) {
    console.error('[auth.signup]', { ...authDiagnostic(error), elapsedMs: Date.now() - startedAt })
    return { error: signupErrorMessage(error) }
  }
  if (signedIn) { revalidatePath('/', 'layout'); redirect('/profile') }
  return { message: 'If this address can be registered, a confirmation email will arrive shortly. Confirm your email, then sign in.' }
}

export async function logout() {
  const client = await createClient()
  const { error } = await client.auth.signOut({ scope: 'local' })
  if (error) throw new Error('Unable to sign out. Please try again.')
  revalidatePath('/', 'layout')
  redirect('/login')
}
