import Link from 'next/link'
import { ArrowRight, Search, Sparkles } from 'lucide-react'
import { FloatingPixels } from '@/components/motion'

export function HomeIntro({ loading = false }: { loading?: boolean }) {
  return <section className="home-intro" aria-labelledby="home-title"><FloatingPixels />
    <div className="intro-copy"><p className="eyebrow"><span className="status-dot" />YOUR LITTLE CORNER OF THE INTERNET</p><h1 id="home-title">Less scrolling.<br />More <span className="happy-underline">happy finds.</span></h1><p className="intro-description">A fresh screen. A good soundtrack. A tiny escape.<br className="desktop-break" /> Find something that feels a little more like you.</p></div>
    <div className="intro-search"><span className="search-note"><Sparkles size={15} aria-hidden="true" /> What are you in the mood for?</span><form action="/search" method="get" role="search" className="home-search"><Search size={19} aria-hidden="true" /><label className="sr-only" htmlFor="home-query">Search wallpapers, music, and games</label><input id="home-query" name="q" type="search" autoComplete="off" placeholder="Find your next little favorite…" disabled={loading} /><button type="submit" aria-label="Search archive" disabled={loading}><ArrowRight size={19} /></button></form><div className="search-suggestions"><span>Try a little</span><Link href="/search?q=cozy">cozy</Link><Link href="/search?q=night">night</Link><Link href="/search?q=chaos">chaos ↗</Link></div></div>
  </section>
}
