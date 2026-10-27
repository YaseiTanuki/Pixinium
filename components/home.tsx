'use client'



import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { useRouter } from 'next/navigation'
import { startTransition, useState, ViewTransition } from 'react'
import { ArrowDown, ArrowRight, ArrowUpRight, Heart, LayoutGrid, Moon, Music2, Search, Shuffle, Sparkles, Sun, Zap } from 'lucide-react'
import { CatalogCard } from '@/components/catalog-card'
import { itemHref, searchHref } from '@/lib/catalog'
import type { CatalogDetail, Category, ContentUse } from '@/lib/entities/catalog'
import { categoryIcon } from '@/lib/category-icons'
import { useSavedItems } from '@/lib/saved-items'

export default function Home({ items, categories, uses, initialFilter = '', initialQuery = '' }: { items: CatalogDetail[]; categories: Category[]; uses: ContentUse[]; initialFilter?: string; initialQuery?: string }) {
  const [filter, setFilter] = useState(initialFilter)
  const router = useRouter()
  const { saved } = useSavedItems()
  const filters = uses
  const visible = items.filter((card) =>
    (filter === 'saved' ? saved.includes(card.item.id) : !filter || card.uses.some(use => use.slug === filter)) &&
    `${card.item.title} ${card.item.summary} ${card.category.name} ${card.tags.map(tag => tag.name).join(' ')}`.toLowerCase().includes(initialQuery.toLowerCase()))
  // Prefer editorial selections; otherwise use the first published cover in catalog order.
  const spotlight = items.find(card => card.item.isFeatured && card.cover) ?? items.find(card => card.cover)
  const music = items.find(card => card.item.isFeatured && card.category.artworkStyle === 'record') ?? items.find(card => card.category.artworkStyle === 'record')

  function chooseFilter(value: string) {
    startTransition(() => setFilter(value))
  }

  return <div className="home-page">
    <a className="skip-home" href="#main">Skip to content</a>
    <SiteHeader />

    <main id="main" className="home-shell">
      <section className="home-intro" aria-labelledby="home-title">
        <div className="intro-copy"><p className="eyebrow"><span className="status-dot" />YOUR LITTLE CORNER OF THE INTERNET</p><h1 id="home-title">Less scrolling.<br />More <span className="happy-underline">happy finds.</span></h1><p className="intro-description">A fresh screen. A good soundtrack. A tiny escape.<br className="desktop-break" /> Find something that feels a little more like you.</p></div>
        <div className="intro-search"><span className="search-note"><Sparkles size={15} aria-hidden="true" /> What are you in the mood for?</span><form action="/search" method="get" role="search" className="home-search"><Search size={19} aria-hidden="true" /><label className="sr-only" htmlFor="home-query">Search wallpapers, music, and games</label><input id="home-query" name="q" type="search" autoComplete="off" placeholder="Find your next little favorite…" /><button type="submit" aria-label="Search archive"><ArrowRight size={19} /></button></form><div className="search-suggestions"><span>Try a little</span><Link href="/search?q=cozy">cozy</Link><Link href="/search?q=night">night</Link><Link href="/search?q=chaos">chaos ↗</Link></div></div>
      </section>

      <section className="feature-grid" aria-label="Discoveries">
        <Link className="feature-main" href={spotlight ? itemHref(spotlight) : '/search?use=images'}>
          <div className="feature-topline"><span className="feature-label"><Sparkles size={13} aria-hidden="true" /> THE SPOTLIGHT</span><span className="edition">{spotlight?.category.name.toUpperCase() ?? 'PIXINIUM'}</span></div>
          <div className="feature-art"><div className="feature-orbit" /><img src={spotlight?.cover?.url ?? '/images/character-fallback.svg'} width={650} height={400} fetchPriority="high" alt={spotlight?.cover?.altText ?? 'Playful illustrated werewolf characters'} style={spotlight?.cover ? { objectPosition: `${spotlight.cover.focalX}% ${spotlight.cover.focalY}%` } : undefined} /><span className="art-stamp">A LITTLE<br />GOOD THING.<Sparkles size={17} aria-hidden="true" /></span></div>
          <div className="feature-main-bottom"><div><p>{spotlight?.category.name.toUpperCase() ?? 'PIXINIUM'}</p><h2>{spotlight?.item.title ?? 'A little space for happy finds.'}</h2><span>{spotlight?.item.summary ?? 'Fresh inspiration is on its way.'}</span></div><span className="round-arrow"><ArrowUpRight size={25} aria-hidden="true" /></span></div>
        </Link>
        <div className="feature-side">
          <Link className="feature-music" href={music ? itemHref(music) : '/search?use=music'}><div><p className="feature-label"><Music2 size={13} aria-hidden="true" /> ON THE RECORD</p><h2>Stay in.<br />Tune out.</h2><p className="music-description">{music?.item.title ?? 'A little quiet. A little rhythm.'}<br /><span>{music?.item.summary ?? 'New sounds are on their way.'}</span></p><span className="text-action">{music ? 'Explore the mix' : 'Explore music'} <ArrowUpRight size={16} aria-hidden="true" /></span></div><div className="hero-record" aria-hidden="true"><div className="record-disc"><span><Moon size={28} fill="currentColor" /></span></div></div><span className="music-index" aria-hidden="true">SIDE A — AFTER HOURS</span></Link>
          <div className="feature-surprise"><span className="surprise-icon"><Shuffle size={22} aria-hidden="true" /></span><div><p className="eyebrow">LET CURIOSITY PICK</p><h2>No plan? Perfect.</h2><p>Your next favorite could be a happy accident.</p></div><button onClick={() => { const item = items[Math.floor(Math.random() * items.length)]; if (item) router.push(itemHref(item)) }} disabled={!items.length} className="surprise-button">Surprise me <ArrowUpRight size={17} aria-hidden="true" /></button></div>
        </div>
      </section>

      <section className="category-grid" aria-label="Explore by category">{categories.map(({ id, slug, name, iconKey, description }, index) => { const Icon = categoryIcon(iconKey); return <Link key={id} href={searchHref({ use: slug })} className={`category-door category-${slug}`}><span className="category-icon"><Icon size={23} strokeWidth={1.6} aria-hidden="true" /></span><div><h2>{name}<span>{String(items.filter((item) => item.category.slug === slug).length).padStart(2, '0')}</span></h2><p>{description}</p></div><ArrowUpRight className="category-arrow" size={19} aria-hidden="true" /><span className="category-number" aria-hidden="true">0{index + 1}</span></Link> })}</section>

      <section className="discover-section" id="discover" aria-labelledby="discover-title">
        <div className="section-heading"><div><p className="eyebrow">WORTH A LITTLE LOOK</p><h2 id="discover-title">Good things, right this way<span>.</span></h2></div><Link href="/search" className="archive-link">Explore the whole archive <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
        <div className="discovery-toolbar"><div className="discovery-filters" aria-label="Filter discoveries">{filters.map(({ slug, name }) => <button key={slug} aria-pressed={filter === slug} className={filter === slug ? 'active' : ''} onClick={() => chooseFilter(slug)}>{slug === '' && <LayoutGrid size={13} aria-hidden="true" />}{slug === 'saved' && <Heart size={13} aria-hidden="true" />}{name}{slug === 'saved' && <span>{saved.length}</span>}</button>)}</div><p role="status">{visible.length} little {visible.length === 1 ? 'find' : 'finds'} <ArrowDown size={12} aria-hidden="true" /></p></div>
        <div className="discovery-grid">{visible.map((item) => <ViewTransition key={item.item.id} enter="home-fade" exit="home-fade"><CatalogCard item={item} /></ViewTransition>)}</div>
        {visible.length === 0 && <div className="collection-empty"><Heart size={30} aria-hidden="true" /><h3>A little space for your favorites.</h3><p>{filter === 'saved' ? 'Tap the heart on any find to save it on this device.' : 'Try another category or search.'}</p><button className="primary-button" onClick={() => chooseFilter('')}>Find something to love <ArrowRight size={16} aria-hidden="true" /></button></div>}
      </section>

      <ViewTransition><section className="mood-section" aria-labelledby="mood-title"><div><p className="eyebrow">FOLLOW YOUR FEELING</p><h2 id="mood-title">There’s a find for every mood.</h2><p>No need to know exactly what you’re looking for.</p></div><div className="mood-links"><Link href="/search?q=cozy"><Sun size={18} aria-hidden="true" /><span>A cozy moment<small>Slow down a little</small></span><ArrowUpRight size={15} aria-hidden="true" /></Link><Link href="/search?q=night"><Moon size={18} aria-hidden="true" /><span>After hours<small>For the night owls</small></span><ArrowUpRight size={15} aria-hidden="true" /></Link><Link href="/search?q=chaos"><Zap size={18} aria-hidden="true" /><span>A little chaos<small>Embrace the fun</small></span><ArrowUpRight size={15} aria-hidden="true" /></Link></div></section></ViewTransition>
    </main>
    <footer className="home-footer home-shell"><Link href="/" className="footer-logo">pixinium<span>.</span></Link><p>A little archive. A lot to love.</p><a href="#main">Back to the good stuff ↑</a></footer>
  </div>
}
