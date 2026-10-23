'use client'

import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { useState } from 'react'
import { ArrowLeft, ArrowUpRight, Check, ChevronRight, Heart, Maximize2, Moon, Music2, Sparkles, Link2 } from 'lucide-react'
import { ArchiveCard } from '@/components/archive-item'
import { ArchiveImage } from '@/components/archive-image'
import type { ArchiveItem } from '@/lib/archive'
import { useSavedItems } from '@/lib/saved-items'

const categoryCopy = {
  Wallpapers: { label: 'A NEW VIEW, A LITTLE MORE YOU', intro: 'A little personality for your everyday.', note: 'Make room for a fresh screen. Keep this find close for the next time your desktop needs a change of scenery.', heading: 'A fresh perspective.', detail: 'A visual find from the Pixinium archive. Take a closer look at the artwork, explore the collection details, and save it for a future screen refresh.', labels: ['Resolution', 'Collection'] },
  Music: { label: 'SOMETHING FOR YOUR ON-REPEAT', intro: 'Good company for your quiet hours.', note: 'For the slow evenings, wandering thoughts, and just-one-more-song moments. Keep this find in your collection.', heading: 'Settle into a different mood.', detail: 'A music find from the Pixinium archive. Check the track count and running time, then save it alongside the sounds you want to return to.', labels: ['Tracks', 'Running time'] },
  Games: { label: 'YOUR NEXT LITTLE ESCAPE', intro: 'A small escape from the everyday.', note: 'A new world for your downtime. Save this little discovery for the next time you feel like an adventure.', heading: 'Leave a little room for play.', detail: 'A game find from the Pixinium archive. Check the listed size and platform, and keep it in your collection for your next gaming break.', labels: ['Size', 'Platform'] },
}

export default function ItemDetail({ item, related }: { item: ArchiveItem; related: ArchiveItem[] }) {
  const { saved, toggleSaved } = useSavedItems()
  const isSaved = saved.includes(item.title)
  const [shareStatus, setShareStatus] = useState('')
  const copy = categoryCopy[item.category]
  const facts = item.meta.split('·').map((value) => value.trim())

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setShareStatus('Link copied. Send a little good thing to someone.')
    } catch {
      setShareStatus('Copy the address from your browser to share this find.')
    }
  }

  return <div className="home-page item-detail-page">
    <a className="skip-home" href="#item-main">Skip to content</a>
    <SiteHeader activeFilter={item.category} />

    <main id="item-main" className="home-shell">
      <nav className="detail-breadcrumb" aria-label="Breadcrumb"><Link href="/search"><ArrowLeft size={14} aria-hidden="true" /> The archive</Link><ChevronRight size={12} aria-hidden="true" /><Link href={`/search?category=${item.category}`}>{item.category}</Link><ChevronRight size={12} aria-hidden="true" /><span aria-current="page">{item.title}</span></nav>

      <div className="detail-hero">
        <section className={`detail-preview ${item.category === 'Music' ? 'detail-preview-music' : ''}`} aria-label={`${item.title} artwork`}>
          <div className="detail-preview-top"><span><Sparkles size={13} aria-hidden="true" /> THE LITTLE DETAILS</span><span>PIXINIUM / {item.category.toUpperCase()}</span></div>
          <div className={`detail-art ${item.color}`}>
            {item.image ? <ArchiveImage src={item.image} alt={`${item.title} collection artwork`} width={800} height={650} fetchPriority="high" className="detail-image" /> : <div className="detail-record" aria-hidden="true"><span className="detail-record-label">PIXINIUM RECORDS</span><div className="record-disc"><span><Moon size={44} fill="currentColor" /></span></div><span className="detail-record-caption">A LITTLE SOUNDTRACK FOR YOUR WORLD</span></div>}
            <span className="detail-stamp" aria-hidden="true">A LITTLE<br />FIND. A LOT<br />TO LOVE.<Sparkles size={19} /></span>
          </div>
          <div className="detail-preview-bottom"><span>{item.image ? 'Collection artwork' : 'On the record'}<small>{item.image ? 'A closer look at your next little favorite.' : 'A soundtrack worth keeping close.'}</small></span>{item.image ? <a href={item.image} target="_blank" rel="noreferrer" className="detail-original" aria-label="Open original artwork in a new tab"><Maximize2 size={16} aria-hidden="true" /></a> : <Music2 size={22} aria-hidden="true" />}</div>
        </section>

        <section className="detail-copy" aria-labelledby="item-title">
          <p className="eyebrow"><span className="status-dot" />{copy.label}</p>
          <div className="detail-tags"><Link href={`/search?category=${item.category}`}>{item.category}</Link><span><Sparkles size={12} aria-hidden="true" /> Pixinium pick</span></div>
          <h1 id="item-title">{item.title}<span>.</span></h1>
          <p className="detail-intro">{copy.intro}</p>
          <p className="detail-description">{copy.note}</p>
          <dl className="detail-facts">{facts.map((fact, index) => <div key={index}><dt>{copy.labels[index] ?? 'Details'}</dt><dd>{fact}</dd></div>)}</dl>
          <button className={`detail-save ${isSaved ? 'detail-saved' : ''}`} onClick={() => toggleSaved(item.title)} aria-pressed={isSaved}>{isSaved ? <Check size={19} aria-hidden="true" /> : <Heart size={19} aria-hidden="true" />}{isSaved ? 'Saved to your collection' : 'Save to your collection'}<span aria-hidden="true">{isSaved ? '♥' : '+'}</span></button>
          <p className="detail-save-note">A little keeper. Find it in your collection anytime.</p>
          <div className="detail-share"><span>Good finds are better shared.</span><button onClick={copyLink}><Link2 size={15} aria-hidden="true" /> Copy link</button></div>
          <p className="detail-share-status" role="status">{shareStatus}</p>
          <div className="detail-note"><Sparkles size={20} aria-hidden="true" /><p>Less scrolling. More happy finds.<span>A little corner of the internet, collected with care.</span></p></div>
        </section>
      </div>

      <section className="detail-about" aria-labelledby="about-title"><div><p className="eyebrow">ABOUT THIS FIND</p><h2 id="about-title">{copy.heading}</h2></div><div><p>{copy.detail}</p><Link href={`/search?category=${item.category}`}>Explore more {item.category.toLowerCase()} <ArrowUpRight size={15} aria-hidden="true" /></Link></div></section>

      {related.length > 0 && <section className="detail-related" aria-labelledby="related-title"><div className="section-heading"><div><p className="eyebrow">KEEP THE GOOD THINGS COMING</p><h2 id="related-title">A few more little favorites<span>.</span></h2></div><Link href="/search" className="archive-link">Explore the archive <ArrowUpRight size={16} aria-hidden="true" /></Link></div><div className="discovery-grid">{related.map((entry) => <ArchiveCard key={entry.title} item={entry} />)}</div></section>}
    </main>
    <footer className="home-footer home-shell"><Link href="/" className="footer-logo">pixinium<span>.</span></Link><p>A little archive. A lot to love.</p><Link href="/search">Back to the good stuff ↑</Link></footer>
  </div>
}
