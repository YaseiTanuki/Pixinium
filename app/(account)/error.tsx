'use client'

import Link from 'next/link'

export default function AccountError({ reset }: { reset: () => void }) {
  return <><p className="eyebrow">A LITTLE DETOUR</p><h1>Your account is temporarily unavailable.</h1>
    <p className="account-description">We couldn’t load your profile. Try again in a moment, or contact support if this continues.</p>
    <div className="account-actions"><button className="account-button" onClick={reset}>Try again</button><Link className="account-text-link" href="/">Back to the archive</Link></div></>
}
