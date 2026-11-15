'use client'

import { useEffect, useRef, useState } from 'react'
import { LoaderCircle, Maximize2, Minimize2, Play, RotateCcw, Square } from 'lucide-react'

export function GamePlayer({ id, title, cover }: { id: string; title: string; cover?: string }) {
  const [playing, setPlaying] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [session, setSession] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const player = useRef<HTMLElement>(null)
  const fullscreenButton = useRef<HTMLButtonElement>(null)
  const isFullscreen = fullscreen || expanded

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === player.current)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  useEffect(() => {
    if (!expanded) return
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    fullscreenButton.current?.focus()
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false)
    }
    document.addEventListener('keydown', escape)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', escape)
    }
  }, [expanded])

  async function toggleFullscreen() {
    if (expanded) { setExpanded(false); return }
    if (document.fullscreenElement === player.current) {
      await document.exitFullscreen()
      return
    }
    try {
      if (!player.current?.requestFullscreen) { setExpanded(true); return }
      await player.current.requestFullscreen()
    } catch {
      // Browsers without element fullscreen can still expand the same running iframe.
      setExpanded(true)
    }
  }

  async function stop() {
    if (document.fullscreenElement === player.current) await document.exitFullscreen().catch(() => {})
    setExpanded(false)
    setPlaying(false)
    setLoaded(false)
  }

  return <div className="detail-media-column">
    <section ref={player} className={`detail-preview game-player${expanded ? ' game-player-expanded' : ''}`} aria-label={`${title} game player`}>
      <div className="game-player-stage" aria-busy={playing && !loaded}>
      {playing ? <iframe key={session} title={`Play ${title}`} src={`/api/games/${id}/play/`} onLoad={() => setLoaded(true)}
        sandbox="allow-scripts allow-pointer-lock allow-forms allow-popups allow-popups-to-escape-sandbox" allow="autoplay; fullscreen; gamepad" allowFullScreen
        referrerPolicy="no-referrer" />
        : <button className="game-player-start" type="button" onClick={() => { setLoaded(false); setPlaying(true) }} aria-label={`Play ${title}`}
          style={cover ? { backgroundImage: `linear-gradient(#0002, #0007), url(${JSON.stringify(cover)})` } : undefined}>
          <span><Play size={24} fill="currentColor" aria-hidden="true" /> Play game</span>
        </button>}
      {playing && !loaded && <div className="game-player-loading" role="status" aria-label="Loading game"><LoaderCircle size={22} aria-hidden="true" /></div>}
      </div>
      {playing && <div className="game-player-toolbar">
        <span className="game-player-title">{title}</span>
        <div className="game-player-actions">
          <button type="button" onClick={() => { setLoaded(false); setSession(value => value + 1) }} aria-label="Restart game" title="Restart game"><RotateCcw size={17} aria-hidden="true" /></button>
          <button type="button" onClick={() => void stop()} aria-label="Stop game" title="Stop game"><Square size={16} aria-hidden="true" /></button>
          <button ref={fullscreenButton} type="button" onClick={() => void toggleFullscreen()} aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} aria-pressed={isFullscreen}>
            {isFullscreen ? <Minimize2 size={18} aria-hidden="true" /> : <Maximize2 size={18} aria-hidden="true" />}
          </button>
        </div>
      </div>}
    </section>
  </div>
}
