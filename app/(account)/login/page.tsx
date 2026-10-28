import { AuthForm } from '@/components/auth-form'
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  return <><p className="eyebrow"><span className="status-dot" /> YOUR LITTLE CORNER</p><h1>Welcome back.</h1><p className="account-description">Settle in. Your little archive is right here.</p><AuthForm mode="login" oauthError={error === 'google'} /></>
}
