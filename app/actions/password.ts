'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { siteOrigin } from '@/lib/seo'
import { authDiagnostic } from '@/lib/auth/errors'
import { forgotPasswordSchema, resetPasswordSchema, type AuthState } from '@/lib/auth/validation'

export async function forgotPassword(_state: AuthState, form: FormData): Promise<AuthState> {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(form))
  if (!parsed.success) return { error: 'Enter a valid email address.' }
  try {
    const origin = (await headers()).get('origin') || siteOrigin().origin
    const client = await createClient()
    const { error } = await client.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: new URL('/auth/recovery', origin).href,
    })
    if (error) {
      console.error('[auth.password.request]', authDiagnostic(error))
      if (error.status === 429) return { error: 'Too many requests. Please wait a few minutes before trying again.' }
      return { error: 'We could not send the reset email. Please try again later.' }
    }
  } catch (error) {
    console.error('[auth.password.request]', authDiagnostic(error))
    return { error: 'We could not reach the password reset service. Please try again.' }
  }
  return { message: 'If an account exists for this email, a reset link will arrive shortly. Check your inbox and spam folder.' }
}

export async function resetPassword(_state: AuthState, form: FormData): Promise<AuthState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(form))
  if (!parsed.success) return { error: 'Use matching passwords of 12–128 characters.' }
  try {
    const client = await createClient()
    const { data, error: userError } = await client.auth.getUser()
    if (userError || !data.user) return { error: 'Your reset session has expired. Request a new reset link.' }
    const { error } = await client.auth.updateUser({ password: parsed.data.password })
    if (error) {
      console.error('[auth.password.update]', authDiagnostic(error))
      if (error.code === 'same_password') return { error: 'Choose a password different from your current password.' }
      if (error.code === 'weak_password') return { error: 'Choose a stronger password with at least 12 characters.' }
      return { error: 'Unable to update your password. Try again or request a new reset link.' }
    }
  } catch (error) {
    console.error('[auth.password.update]', authDiagnostic(error))
    return { error: 'We could not reach the password reset service. Please try again.' }
  }
  revalidatePath('/', 'layout')
  return { message: 'Your password has been updated.' }
}
