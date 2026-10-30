'use client'

import { useRef, useState } from 'react'
import { Music2, Play } from 'lucide-react'
import type { CatalogDetail } from '@/lib/entities/catalog'

import { playbackUrl } from '@/lib/media'
import { formatDuration } from '@/lib/media-details'

export function MusicPlayer({ item }: { item: CatalogDetail }) {
  const tracks = item.media.filter(asset => asset.role === 'download' && asset.mediaType === 'audio')
  const [selected, setSelected] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)
  const audio = useRef<HTMLAudioElement>(null)
  const track = tracks[selected]
  const label = track?.altText || `Track ${selected + 1}`

  async function selectTrack(index: number) {
    const player = audio.current
    if (!player) return
    setFailed(false)
    if (index !== selected) {
      player.src = playbackUrl(tracks[index].url)
      setSelected(index)
    }
    try { await player.play() } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setFailed(true)
    }
  }

  return <section className="music-player" aria-label={`${item.item.title} music player`}>
    <div className="music-player-art" style={{ backgroundColor: item.item.accentColor }}>
      {item.cover ? <img src={item.cover.url} alt={item.cover.altText} width={800} height={650} fetchPriority="high"
        style={{ objectPosition: `${item.cover.focalX}% ${item.cover.focalY}%` }} />
        : <Music2 size={64} aria-label="No cover artwork" />}
    </div>
    <div className="music-player-body">
      <div className="music-player-heading"><span className="music-player-eyebrow"><Music2 size={13} aria-hidden="true" /> {playing ? 'Now playing' : 'Press play, stay a while'}</span><span>{tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}</span></div>
      {track ? <>
        <p className="music-player-title">{label}</p>
        <audio ref={audio} controls preload="none" src={playbackUrl(track.url)} aria-label={`Listen to ${label}`}
          onError={() => { setFailed(true); setPlaying(false) }} onCanPlay={() => setFailed(false)}
          onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
          onPlay={event => {
            setPlaying(true)
            document.querySelectorAll('audio').forEach(player => { if (player !== event.currentTarget) player.pause() })
          }} />
        {failed && <p className="music-player-error" role="status">This track could not play. Try another track or download it to listen.</p>}
        {tracks.length > 1 && <ol className="music-player-tracks" aria-label="Tracks">
          {tracks.map((entry, index) => <li key={entry.id} data-active={index === selected}>
            <button type="button" onClick={() => void selectTrack(index)} aria-current={index === selected ? 'true' : undefined}
              aria-label={`Play ${entry.altText || `track ${index + 1}`}`}>
              <span className="music-track-number">{index === selected ? <Play size={14} aria-hidden="true" /> : String(index + 1).padStart(2, '0')}</span>
              <span className="music-track-label">{entry.altText || `Track ${index + 1}`}</span>
              {formatDuration(entry.durationSeconds) && <span className="music-track-duration">{formatDuration(entry.durationSeconds)}</span>}
            </button>
          </li>)}
        </ol>}
      </> : <p className="music-player-title">No tracks available yet.</p>}
    </div>
  </section>
}
