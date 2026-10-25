import Link from 'next/link'
export default function ConfirmationError() {
  return <><p className="eyebrow"><span className="status-dot" /> A LITTLE DETOUR</p><h1>Let’s get you back.</h1><p className="account-description">This confirmation link may have expired or already been used. If you’ve confirmed your email, sign in to continue.</p><Link className="account-button" href="/login">Back to sign in</Link></>
}
