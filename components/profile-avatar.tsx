'use client'

import { useState } from 'react'

export function ProfileAvatar({ name, url }: { name: string; url: string | null }) {
  const [failed, setFailed] = useState(false)
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0] ?? '').join('').toUpperCase() || 'P'
  return <div className="profile-portrait">
    {url && !failed ? <img src={url} alt={`${name}'s avatar`} width={96} height={96} referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : <span role="img" aria-label={`${name}'s avatar`}>{initials}</span>}
  </div>
}
