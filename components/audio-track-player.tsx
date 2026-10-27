'use client'

import { useState } from 'react'
import { playbackUrl } from '@/lib/media'

export function AudioTrackPlayer({ url, label }: { url: string; label: string }) {
  const [failed, setFailed] = useState(false)
  // External media already has a playable URL; private S3 media uses our range-capable route.
  const source = playbackUrl(url)
  return <div className="min-w-0 space-y-3 rounded-xl border border-[#e4dad4] p-4">
    <p className="break-words font-semibold">{label}</p>
    <audio controls preload="none" src={source} aria-label={`Listen to ${label}`} className="w-full"
      onError={() => setFailed(true)} onCanPlay={() => setFailed(false)}
      onPlay={event => {
        document.querySelectorAll('audio').forEach(player => { if (player !== event.currentTarget) player.pause() })
      }} />
    {failed && <p role="status" className="text-sm">This track could not be played here. You can download it to listen.</p>}
    <a href={url} className="account-text-link">Download track</a>
  </div>
}
