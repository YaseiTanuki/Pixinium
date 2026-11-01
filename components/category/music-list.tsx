'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { ArrowUpRight, Download, Eye, Pause, Play } from 'lucide-react'
import { ItemArtwork } from '@/components/catalog-card'
import { CollectButton } from '@/components/collect-button'
import { itemHref } from '@/lib/catalog'
import { formatDuration } from '@/lib/media-details'
import { playbackUrl } from '@/lib/media'
import type { CatalogDetail } from '@/lib/entities/catalog'
import styles from './music-list.module.css'

const countFormat = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

function MusicRow({ item, index }: { item: CatalogDetail; index: number }) {
  const track = item.media.find(asset => asset.role === 'preview' && asset.mediaType === 'audio')
    ?? item.media.find(asset => asset.role === 'download' && asset.mediaType === 'audio')
  const audio = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(track?.durationSeconds ?? 0)
  const [seekable, setSeekable] = useState(false)
  async function togglePlayback() {
    const player = audio.current
    if (!player) return
    if (!player.paused) { player.pause(); return }
    setFailed(false)
    try { await player.play() } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setFailed(true)
    }
  }
  return <li className={styles.track} data-playing={playing}>
    <div className={styles.artwork}>
      <div className={styles.vinyl} aria-hidden="true"><span /></div>
      <Link className={styles.cover} href={itemHref(item)} aria-label={`View ${item.item.title}`}><ItemArtwork item={item} /></Link>
    </div>
    <div className={styles.body}>
      <div className={styles.heading}>
        <div className={styles.info}><h2><Link href={itemHref(item)}>{item.item.title}</Link></h2>
          <div className={styles.tags}>{item.tags.slice(0, 3).map(tag => <span key={tag.id}>{tag.name}</span>)}</div>
        </div>
        <Link className={styles.open} href={itemHref(item)} aria-label={`Open ${item.item.title}`}><ArrowUpRight size={19} aria-hidden="true" /></Link>
      </div>
      <div className={styles.player}>
    <button type="button" className={styles.play} disabled={!track} onClick={() => void togglePlayback()}
      aria-pressed={playing}
      aria-label={`${playing ? 'Pause' : 'Play preview of'} ${item.item.title}`}>
      {playing ? <Pause size={18} fill="currentColor" aria-hidden="true" /> : <Play size={18} fill="currentColor" aria-hidden="true" />}
    </button>
      <input type="range" min={0} max={duration || 1} step={0.1} value={Math.min(position, duration || 1)} disabled={!duration || !seekable}
        aria-label={`Seek in ${item.item.title}`} aria-valuetext={`${formatDuration(position) ?? '0:00'} of ${formatDuration(duration) ?? 'unknown duration'}`}
        onChange={event => { if (audio.current) { const time = Number(event.target.value); audio.current.currentTime = time; setPosition(time) } }} />
      <span className={styles.time}>{formatDuration(position) ?? '0:00'} / {formatDuration(duration) ?? '—'}</span>
      </div>
      {failed && <p className={styles.error} role="status">Preview unavailable. Open the track to try again.</p>}
      {!track && <p className={styles.error}>No preview available</p>}
      <div className={styles.footer}>
        <span className={styles.status}>{playing ? 'Now playing' : `Track ${String(index + 1).padStart(2, '0')}`}</span>
        <div className={styles.stats}>
          <span title="Views" aria-label={`${item.viewCount ?? 0} views`}><Eye size={14} aria-hidden="true" />{countFormat.format(item.viewCount ?? 0)}<span className={styles.statLabel}> views</span></span>
          <CollectButton item={item} showCount />
          <span title="Downloads" aria-label={`${item.downloadCount ?? 0} downloads`}><Download size={14} aria-hidden="true" />{countFormat.format(item.downloadCount ?? 0)}<span className={styles.statLabel}> downloads</span></span>
        </div>
      </div>
    </div>
    {track && <audio ref={audio} src={playbackUrl(track.url)} preload="none"
      onLoadedMetadata={event => { const seconds = event.currentTarget.duration; if (Number.isFinite(seconds)) { setDuration(seconds); setSeekable(true) } }}
      onTimeUpdate={event => setPosition(event.currentTarget.currentTime)}
      onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => { setFailed(true); setPlaying(false); setSeekable(false) }}
      onPlay={event => { setPlaying(true); document.querySelectorAll('audio').forEach(player => { if (player !== event.currentTarget) player.pause() }) }} />}
  </li>
}

export function MusicList({ items }: { items: CatalogDetail[] }) {
  return <ol className={styles.shelf} aria-label="Music previews">{items.map((item, index) => <MusicRow key={item.item.id} item={item} index={index} />)}</ol>
}
