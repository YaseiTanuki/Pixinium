import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { UserRound } from 'lucide-react'
import { getAccount } from '@/server/services/auth.service'
import { UsernameForm } from '@/components/username-form'
import { logout } from '@/app/actions/auth'

export const metadata: Metadata = { title: 'Choose your username — Pixinium' }

export default async function ChooseUsernamePage() {
  const account = await getAccount()
  if (!account) redirect('/login')
  if (account.username) redirect('/profile')

  return <>
    <p className="eyebrow"><span className="status-dot" /> ONE LAST LITTLE THING</p>
    <div className="account-avatar" aria-hidden="true"><UserRound size={25} /></div>
    <h1>Make it yours.</h1>
    <p className="account-description">Every little corner needs a name. Choose how you’ll be known around Pixinium.</p>
    <UsernameForm />
    <form action={logout} className="username-account-footer">
      <p>Signed in as <span>{account.email}</span></p>
      <button className="account-text-link" type="submit">Use a different account</button>
    </form>
  </>
}
