'use client'

import { ArchiveImage } from '@/components/archive-image'

import Link from 'next/link'
import { startTransition, useState, ViewTransition } from 'react'
import { ArrowDown, ArrowRight, ArrowUpRight, Gamepad2, Heart, Image as ImageIcon, LayoutGrid, Moon, Music2, Search, Shuffle, Sparkles, Sun, Zap } from 'lucide-react'
import { ArchiveCard, ItemPreview } from '@/components/archive-item'
import { filters, stickerSheet, type ArchiveItem } from '@/lib/archive'
import { useSavedItems } from '@/lib/saved-items'

const categories = [
  { name: 'Wallpapers', icon: ImageIcon, note: 'A new view for your everyday.', className: 'category-wallpaper' },
  { name: 'Music', icon: Music2, note: 'Find your next on-repeat.', className: 'category-music' },
  { name: 'Games', icon: Gamepad2, note: 'A small escape. A new adventure.', className: 'category-games' },
]

export default function Home({ items }: { items: ArchiveItem[] }) {
  const [filter, setFilter] = useState('All items')
  const [selected, setSelected] = useState<ArchiveItem | null>(null)
  const { saved } = useSavedItems()
  const visible = items.filter((item) => filter === 'Saved' ? saved.includes(item.title) : filter === 'All items' || item.category === filter)

  function chooseFilter(value: string) {
    startTransition(() => setFilter(value))
  }

  return <div className="home-page">
    <a className="skip-home" href="#main">Skip to content</a>
    <header className="home-header">
      <div className="home-shell header-inner">
        <Link href="/" aria-label="Pixinium home" className="home-logo"><span className="logo-symbol"><Sparkles size={18} fill="currentColor" aria-hidden="true" /></span>pixinium<span className="logo-dot">.</span></Link>
        <nav aria-label="Main navigation" className="home-navigation"><Link href="/" aria-current="page">Discover</Link><Link href="/search">The archive <ArrowUpRight size={13} aria-hidden="true" /></Link></nav>
        <a href="#discover" className="collection-link" onClick={() => chooseFilter('Saved')}><Heart size={16} aria-hidden="true" /><span>Your collection</span><span className="collection-count">{saved.length}</span></a>
      </div>
    </header>

    <main id="main" className="home-shell">
      <section className="home-intro" aria-labelledby="home-title">
        <div className="intro-copy"><p className="eyebrow"><span className="status-dot" />YOUR LITTLE CORNER OF THE INTERNET</p><h1 id="home-title">Less scrolling.<br />More <span className="happy-underline">happy finds.</span></h1><p className="intro-description">A fresh screen. A good soundtrack. A tiny escape.<br className="desktop-break" /> Find something that feels a little more like you.</p></div>
        <div className="intro-search"><span className="search-note"><Sparkles size={15} aria-hidden="true" /> What are you in the mood for?</span><form action="/search" method="get" role="search" className="home-search"><Search size={19} aria-hidden="true" /><label className="sr-only" htmlFor="home-query">Search wallpapers, music, and games</label><input id="home-query" name="q" type="search" autoComplete="off" placeholder="Find your next little favorite…" /><button type="submit" aria-label="Search archive"><ArrowRight size={19} /></button></form><div className="search-suggestions"><span>Try a little</span><Link href="/search?q=cozy">cozy</Link><Link href="/search?q=night">night</Link><Link href="/search?q=chaos">chaos ↗</Link></div></div>
      </section>

      <section className="feature-grid" aria-label="Featured discoveries">
        <button className="feature-main" onClick={() => setSelected(items[0] ?? null)}>
          <div className="feature-topline"><span className="feature-label"><Sparkles size={13} aria-hidden="true" /> THE SPOTLIGHT</span><span className="edition">NO. 001 / CHARACTER CLUB</span></div>
          <div className="feature-art"><div className="feature-orbit" /><ArchiveImage src={stickerSheet} width={650} height={400} fetchPriority="high" alt="Expressive chibi werewolf characters in a playful sticker collection" /><span className="art-stamp">SMALL GUY.<br />BIG ENERGY.<Sparkles size={17} aria-hidden="true" /></span></div>
          <div className="feature-main-bottom"><div><p>WALLPAPER COLLECTION</p><h2>A little wild.<br />A lot to love.</h2><span>Meet Exploding Werewolf. Your desktop’s new personality.</span></div><span className="round-arrow"><ArrowUpRight size={25} aria-hidden="true" /></span></div>
        </button>
        <div className="feature-side">
          <button className="feature-music" onClick={() => setSelected(items.find((item) => item.category === 'Music') ?? null)}><div><p className="feature-label"><Music2 size={13} aria-hidden="true" /> ON THE RECORD</p><h2>Stay in.<br />Tune out.</h2><p className="music-description">Velvet After Dark<br /><span>8 tracks · 32 minutes of your own</span></p><span className="text-action">Explore the mix <ArrowUpRight size={16} aria-hidden="true" /></span></div><div className="hero-record" aria-hidden="true"><div className="record-disc"><span><Moon size={28} fill="currentColor" /></span></div></div><span className="music-index" aria-hidden="true">SIDE A — AFTER HOURS</span></button>
          <div className="feature-surprise"><span className="surprise-icon"><Shuffle size={22} aria-hidden="true" /></span><div><p className="eyebrow">LET CURIOSITY PICK</p><h2>No plan? Perfect.</h2><p>Your next favorite could be a happy accident.</p></div><button onClick={() => setSelected(items[Math.floor(Math.random() * items.length)] ?? null)} className="surprise-button">Surprise me <ArrowUpRight size={17} aria-hidden="true" /></button></div>
        </div>
      </section>

      <section className="category-grid" aria-label="Explore by category">{categories.map(({ name, icon: Icon, note, className }, index) => <Link key={name} href={`/search?category=${name}`} className={`category-door ${className}`}><span className="category-icon"><Icon size={23} strokeWidth={1.6} aria-hidden="true" /></span><div><h2>{name}<span>{String(items.filter((item) => item.category === name).length).padStart(2, '0')}</span></h2><p>{note}</p></div><ArrowUpRight className="category-arrow" size={19} aria-hidden="true" /><span className="category-number" aria-hidden="true">0{index + 1}</span></Link>)}</section>

      <section className="discover-section" id="discover" aria-labelledby="discover-title">
        <div className="section-heading"><div><p className="eyebrow">WORTH A LITTLE LOOK</p><h2 id="discover-title">Good things, right this way<span>.</span></h2></div><Link href="/search" className="archive-link">Explore the whole archive <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
        <div className="discovery-toolbar"><div className="discovery-filters" aria-label="Filter discoveries">{[...filters, 'Saved'].map((label) => <button key={label} aria-pressed={filter === label} className={filter === label ? 'active' : ''} onClick={() => chooseFilter(label)}>{label === 'All items' && <LayoutGrid size={13} aria-hidden="true" />}{label === 'Saved' && <Heart size={13} aria-hidden="true" />}{label}{label === 'Saved' && <span>{saved.length}</span>}</button>)}</div><p role="status">{visible.length} little {visible.length === 1 ? 'find' : 'finds'} <ArrowDown size={12} aria-hidden="true" /></p></div>
        <div className="discovery-grid">{visible.map((item) => <ViewTransition key={item.title} enter="home-fade" exit="home-fade"><ArchiveCard item={item} onOpen={() => setSelected(item)} /></ViewTransition>)}</div>
        {visible.length === 0 && <div className="collection-empty"><Heart size={30} aria-hidden="true" /><h3>A little space for your favorites.</h3><p>Tap the heart on any find to keep it here for later.</p><button className="primary-button" onClick={() => chooseFilter('All items')}>Find something to love <ArrowRight size={16} aria-hidden="true" /></button></div>}
      </section>

      <ViewTransition><section className="mood-section" aria-labelledby="mood-title"><div><p className="eyebrow">FOLLOW YOUR FEELING</p><h2 id="mood-title">There’s a find for every mood.</h2><p>No need to know exactly what you’re looking for.</p></div><div className="mood-links"><Link href="/search?q=cozy"><Sun size={18} aria-hidden="true" /><span>A cozy moment<small>Slow down a little</small></span><ArrowUpRight size={15} aria-hidden="true" /></Link><Link href="/search?q=night"><Moon size={18} aria-hidden="true" /><span>After hours<small>For the night owls</small></span><ArrowUpRight size={15} aria-hidden="true" /></Link><Link href="/search?q=chaos"><Zap size={18} aria-hidden="true" /><span>A little chaos<small>Embrace the fun</small></span><ArrowUpRight size={15} aria-hidden="true" /></Link></div></section></ViewTransition>
    </main>
    <footer className="home-footer home-shell"><Link href="/" className="footer-logo">pixinium<span>.</span></Link><p>A little archive. A lot to love.</p><a href="#main">Back to the good stuff ↑</a></footer>
    <ItemPreview item={selected} onClose={() => setSelected(null)} />
  </div>
}
