import { NavigationForm } from '@/components/navigation-form'
import Link from '@/components/navigation-link'
import { ArrowRight, Search, Sparkles } from 'lucide-react'
import { FloatingPixels } from '@/components/motion'

export function HomeIntro({ loading = false }: { loading?: boolean }) {
  return <section className="home-intro" aria-labelledby="home-title"><FloatingPixels />
    <div className="intro-copy"><p className="eyebrow"><span className="status-dot" />YOUR LITTLE MINE OF DIGITAL FINDS</p><h1 id="home-title">Mine now.<br /><span className="happy-underline">Regret later.</span></h1><p className="intro-description">A fresh screen. A good soundtrack. A tiny escape.<br className="desktop-break" /> Find something that feels a little more like you.</p></div>
    <div className="intro-search"><span className="search-note"><Sparkles size={15} aria-hidden="true" /> What are you in the mood for?</span><NavigationForm action="/search" role="search" className="home-search"><Search size={19} aria-hidden="true" /><label className="sr-only" htmlFor="home-query">Search wallpapers, music, and games</label><input id="home-query" name="q" type="search" autoComplete="off" placeholder="Find your next little favorite…" disabled={loading} /><button type="submit" aria-label="Search the Mine" disabled={loading}><ArrowRight size={19} /></button></NavigationForm><div className="search-suggestions"><span>Try a little</span><Link href="/search?q=cozy">cozy</Link><Link href="/search?q=night">night</Link><Link href="/search?q=chaos">chaos ↗</Link></div></div>
  </section>
}
