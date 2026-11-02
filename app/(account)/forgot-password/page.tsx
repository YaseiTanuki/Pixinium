import { PasswordForm } from '@/components/password-form'

export const metadata = { title: 'Forgot password' }

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  return <><h1>Forgot your password?</h1><p className="account-description">Enter your email and we’ll send you a link to reset it.</p>{error === 'expired' && <p role="alert" className="account-notice">This reset link has expired or could not be verified. Request a new one below.</p>}<PasswordForm mode="forgot" /></>
}
