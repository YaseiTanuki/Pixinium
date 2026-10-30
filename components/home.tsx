'use client'



import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { BrandLogo } from '@/components/brand-logo'
import { useRouter } from 'next/navigation'
import { ViewTransition } from 'react'
import { ArrowDown, ArrowRight, ArrowUpRight, Heart, Moon, Music2, Search, Shuffle, Sparkles, Sun, Zap } from 'lucide-react'
import { CatalogCard } from '@/components/catalog-card'
import { MasonryGrid } from '@/components/masonry-grid'
import { CATALOG_DISPLAY, categoryHref, itemHref } from '@/lib/catalog'
import { contentKind } from '@/lib/content-types'
import type { CatalogDetail, Category } from '@/lib/entities/catalog'
import { categoryIcon } from '@/lib/category-icons'

export default function Home({ items, categories, spotlightId, musicId, initialQuery = '' }: { items: CatalogDetail[]; categories: Category[]; spotlightId: string | null; musicId: string | null; initialQuery?: string }) {
  const router = useRouter()
  const visible = items.filter((card) =>
    `${card.item.title} ${card.item.summary} ${card.category.name} ${card.tags.map(tag => tag.name).join(' ')}`.toLowerCase().includes(initialQuery.toLowerCase())).slice(0, CATALOG_DISPLAY.homeItems)
  const spotlight = items.find(card => card.item.id === spotlightId)
  const music = items.find(card => card.item.id === musicId)
  const imageCategory = categories.find(category => contentKind(category.metadataSchemaKey) === 'image')
  const musicCategory = categories.find(category => contentKind(category.metadataSchemaKey) === 'music')
  const imageCategoryHref = imageCategory ? categoryHref(imageCategory.slug) : '/search'
  const musicCategoryHref = musicCategory ? categoryHref(musicCategory.slug) : '/search'

  return <div className="home-page">
    <a className="skip-home" href="#main">Skip to content</a>
    <SiteHeader />

    <main id="main" className="home-shell">
      <section className="home-intro" aria-labelledby="home-title">
        <div className="intro-copy"><p className="eyebrow"><span className="status-dot" />YOUR LITTLE CORNER OF THE INTERNET</p><h1 id="home-title">Less scrolling.<br />More <span className="happy-underline">happy finds.</span></h1><p className="intro-description">A fresh screen. A good soundtrack. A tiny escape.<br className="desktop-break" /> Find something that feels a little more like you.</p></div>
        <div className="intro-search"><span className="search-note"><Sparkles size={15} aria-hidden="true" /> What are you in the mood for?</span><form action="/search" method="get" role="search" className="home-search"><Search size={19} aria-hidden="true" /><label className="sr-only" htmlFor="home-query">Search wallpapers, music, and games</label><input id="home-query" name="q" type="search" autoComplete="off" placeholder="Find your next little favorite…" /><button type="submit" aria-label="Search archive"><ArrowRight size={19} /></button></form><div className="search-suggestions"><span>Try a little</span><Link href="/search?q=cozy">cozy</Link><Link href="/search?q=night">night</Link><Link href="/search?q=chaos">chaos ↗</Link></div></div>
      </section>

      <section className="feature-grid" aria-label="Discoveries">
        <Link className="feature-main" href={spotlight ? itemHref(spotlight) : imageCategoryHref}>
          <div className="feature-topline"><span className="feature-label"><Sparkles size={13} aria-hidden="true" /> THE SPOTLIGHT</span><span className="edition">{spotlight?.category.name.toUpperCase() ?? 'PIXINIUM'}</span></div>
          <div className="feature-art"><div className="feature-orbit" /><img src={spotlight?.cover?.url ?? '/images/character-fallback.svg'} width={650} height={400} fetchPriority="high" alt={spotlight?.cover?.altText ?? 'Playful illustrated werewolf characters'} style={spotlight?.cover ? { objectPosition: `${spotlight.cover.focalX}% ${spotlight.cover.focalY}%` } : undefined} /><span className="art-stamp">A LITTLE<br />GOOD THING.<Sparkles size={17} aria-hidden="true" /></span></div>
          <div className="feature-main-bottom"><div><p>{spotlight?.category.name.toUpperCase() ?? 'PIXINIUM'}</p><h2>{spotlight?.item.title ?? 'A little space for happy finds.'}</h2><span>{spotlight?.item.summary ?? 'Fresh inspiration is on its way.'}</span></div><span className="round-arrow"><ArrowUpRight size={25} aria-hidden="true" /></span></div>
        </Link>
        <div className="feature-side">
          <Link className="feature-music" href={music ? itemHref(music) : musicCategoryHref}><div><p className="feature-label"><Music2 size={13} aria-hidden="true" /> ON THE RECORD</p><h2>Stay in.<br />Tune out.</h2><p className="music-description">{music?.item.title ?? 'A little quiet. A little rhythm.'}<br /><span>{music?.item.summary ?? 'New sounds are on their way.'}</span></p><span className="text-action">{music ? 'Explore the mix' : 'Explore music'} <ArrowUpRight size={16} aria-hidden="true" /></span></div><div className="hero-record" aria-hidden="true"><div className="record-disc"><span><Moon size={28} fill="currentColor" /></span></div></div><span className="music-index" aria-hidden="true">SIDE A — AFTER HOURS</span></Link>
          <div className="feature-surprise"><span className="surprise-icon"><Shuffle size={22} aria-hidden="true" /></span><div><p className="eyebrow">LET CURIOSITY PICK</p><h2>No plan? Perfect.</h2><p>Your next favorite could be a happy accident.</p></div><button onClick={() => { const item = items[Math.floor(Math.random() * items.length)]; if (item) router.push(itemHref(item)) }} disabled={!items.length} className="surprise-button">Surprise me <ArrowUpRight size={17} aria-hidden="true" /></button></div>
        </div>
      </section>

      <section className="category-grid" aria-label="Explore by category">{categories.map(({ id, slug, name, iconKey, description }, index) => { const Icon = categoryIcon(iconKey); return <Link key={id} href={categoryHref(slug)} className={`category-door category-${slug}`}><span className="category-icon"><Icon size={23} strokeWidth={1.6} aria-hidden="true" /></span><div><h2>{name}<span>{String(items.filter((item) => item.category.slug === slug).length).padStart(2, '0')}</span></h2><p>{description}</p></div><ArrowUpRight className="category-arrow" size={19} aria-hidden="true" /><span className="category-number" aria-hidden="true">0{index + 1}</span></Link> })}</section>

      <section className="discover-section" id="discover" aria-labelledby="discover-title">
        <div className="section-heading"><div><p className="eyebrow">WORTH A LITTLE LOOK</p><h2 id="discover-title">Good things, right this way<span>.</span></h2></div><Link href="/search" className="archive-link">Explore the whole archive <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
        <div className="discovery-toolbar"><p role="status">{visible.length} little {visible.length === 1 ? 'find' : 'finds'} <ArrowDown size={12} aria-hidden="true" /></p></div>
        <MasonryGrid className="discovery-grid">{visible.map((item) => <ViewTransition key={item.item.id} enter="home-fade" exit="home-fade"><CatalogCard item={item} variant="detailed" /></ViewTransition>)}</MasonryGrid>
        {visible.length === 0 && <div className="collection-empty"><Heart size={30} aria-hidden="true" /><h3>A little space for your favorites.</h3><p>Try another category or search.</p><Link className="primary-button" href="/search">Find something to love <ArrowRight size={16} aria-hidden="true" /></Link></div>}
      </section>

      <ViewTransition><section className="mood-section" aria-labelledby="mood-title"><div><p className="eyebrow">FOLLOW YOUR FEELING</p><h2 id="mood-title">There’s a find for every mood.</h2><p>No need to know exactly what you’re looking for.</p></div><div className="mood-links"><Link href="/search?q=cozy"><Sun size={18} aria-hidden="true" /><span>A cozy moment<small>Slow down a little</small></span><ArrowUpRight size={15} aria-hidden="true" /></Link><Link href="/search?q=night"><Moon size={18} aria-hidden="true" /><span>After hours<small>For the night owls</small></span><ArrowUpRight size={15} aria-hidden="true" /></Link><Link href="/search?q=chaos"><Zap size={18} aria-hidden="true" /><span>A little chaos<small>Embrace the fun</small></span><ArrowUpRight size={15} aria-hidden="true" /></Link></div></section></ViewTransition>
    </main>
    <footer className="home-footer home-shell"><BrandLogo className="brand-logo-footer" /><p>A little archive. A lot to love.</p><a href="#main">Back to the good stuff ↑</a></footer>
  </div>
}
