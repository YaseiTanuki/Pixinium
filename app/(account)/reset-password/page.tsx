import { PasswordForm } from '@/components/password-form'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Reset password' }

export default async function ResetPasswordPage() {
  const client = await createClient()
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) return <><h1>Request a reset link.</h1><p className="account-description">Open the link in your reset email to choose a new password. If it has expired, request a new one.</p></>
  return <><h1>A fresh start.</h1><p className="account-description">Choose a new password for your Pixinium account.</p><PasswordForm mode="reset" /></>
}
