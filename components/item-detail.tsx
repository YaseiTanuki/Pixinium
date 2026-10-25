'use client'

import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { useState } from 'react'
import { ArrowLeft, ArrowUpRight, Check, ChevronRight, Heart, Image as ImageIcon, Maximize2, Moon, Music2, Sparkles, Link2 } from 'lucide-react'
import { CatalogCard } from '@/components/catalog-card'

import type { CatalogDetail, CatalogCard as Card, Category } from '@/lib/entities/catalog'
import { useSavedItems } from '@/lib/saved-items'

export default function ItemDetail({ item, related, categories }: { item: CatalogDetail; related: Card[]; categories: Category[] }) {
  const { saved, toggleSaved } = useSavedItems()
  const isSaved = saved.includes(item.item.id)
  const [shareStatus, setShareStatus] = useState('')

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
    <SiteHeader />

    <main id="item-main" className="home-shell">
      <nav className="detail-breadcrumb" aria-label="Breadcrumb"><Link href="/search"><ArrowLeft size={14} aria-hidden="true" /> The archive</Link><ChevronRight size={12} aria-hidden="true" /><Link href={`/search?use=${item.category.slug}`}>{item.category.name}</Link><ChevronRight size={12} aria-hidden="true" /><span aria-current="page">{item.item.title}</span></nav>

      <div className="detail-hero">
        <section className={`detail-preview ${item.category.artworkStyle === 'record' ? 'detail-preview-music' : ''}`} aria-label={`${item.item.title} artwork`}>
          <div className="detail-preview-top"><span><Sparkles size={13} aria-hidden="true" /> THE LITTLE DETAILS</span><span>PIXINIUM / {item.category.name.toUpperCase()}</span></div>
          <div className="detail-art" style={{ backgroundColor: item.item.accentColor }}>
            {item.cover ? <img src={item.cover.url} alt={item.cover.altText} width={800} height={650} fetchPriority="high" className="detail-image" /> : item.category.artworkStyle === 'record' ? <div className="detail-record" aria-hidden="true"><span className="detail-record-label">PIXINIUM RECORDS</span><div className="record-disc"><span><Moon size={44} fill="currentColor" /></span></div><span className="detail-record-caption">A LITTLE SOUNDTRACK FOR YOUR WORLD</span></div> : <ImageIcon size={60} aria-label="No cover artwork" />}
            <span className="detail-stamp" aria-hidden="true">A LITTLE<br />FIND. A LOT<br />TO LOVE.<Sparkles size={19} /></span>
          </div>
          <div className="detail-preview-bottom"><span>{item.cover ? 'Collection artwork' : 'On the record'}<small>{item.cover ? 'A closer look at your next little favorite.' : 'A soundtrack worth keeping close.'}</small></span>{item.cover ? <a href={item.cover.url} target="_blank" rel="noreferrer" className="detail-original" aria-label="Open original artwork in a new tab"><Maximize2 size={16} aria-hidden="true" /></a> : <Music2 size={22} aria-hidden="true" />}</div>
        </section>

        <section className="detail-copy" aria-labelledby="item-title">
          <p className="eyebrow"><span className="status-dot" />{item.category.name}</p>
          <div className="detail-tags"><Link href={`/search?use=${item.category.slug}`}>{item.category.name}</Link>{item.item.isFeatured && <span><Sparkles size={12} aria-hidden="true" /> Pixinium pick</span>}{item.tags.map(tag => <span key={tag.id}>{tag.name}</span>)}</div>
          <h1 id="item-title">{item.item.title}<span>.</span></h1>
          <p className="detail-intro">{item.item.summary}</p>
          <p className="detail-description">{item.description}</p>
          {item.uses.length > 0 && <div className="detail-tags" aria-label="Suitable for">{item.uses.map(use => <Link key={use.slug} href={`/search?use=${encodeURIComponent(use.slug)}`}>{use.name}</Link>)}</div>}
          <dl className="detail-facts">{item.facts.map((fact) => <div key={fact.key}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>
          <button className={`detail-save ${isSaved ? 'detail-saved' : ''}`} onClick={() => toggleSaved(item.item.id)} aria-pressed={isSaved}>{isSaved ? <Check size={19} aria-hidden="true" /> : <Heart size={19} aria-hidden="true" />}{isSaved ? 'Saved on this device' : 'Save on this device'}<span aria-hidden="true">{isSaved ? '♥' : '+'}</span></button>
          <p className="detail-save-note">A little keeper. Find it in your collection on this device.</p>
          <div className="detail-share"><span>Good finds are better shared.</span><button onClick={copyLink}><Link2 size={15} aria-hidden="true" /> Copy link</button></div>
          <p className="detail-share-status" role="status">{shareStatus}</p>
          <div className="detail-note"><Sparkles size={20} aria-hidden="true" /><p>Less scrolling. More happy finds.<span>A little corner of the internet, collected with care.</span></p></div>
        </section>
      </div>

      <section className="detail-about" aria-labelledby="about-title"><div><p className="eyebrow">ABOUT THIS FIND</p><h2 id="about-title">{item.item.title}</h2></div><div><p>{item.description || item.item.summary}</p><Link href={`/search?use=${item.category.slug}`}>Explore more {item.category.name.toLowerCase()} <ArrowUpRight size={15} aria-hidden="true" /></Link></div></section>

      {item.media.some(asset => asset.role !== 'cover') && <section className="detail-about" aria-label="Item media"><h2>Explore this find</h2><div>{item.media.filter(asset => asset.role !== 'cover').map(asset => <p key={asset.id}><a href={asset.url} target="_blank" rel="noreferrer">{asset.altText || asset.role}</a></p>)}</div></section>}

      {related.length > 0 && <section className="detail-related" aria-labelledby="related-title"><div className="section-heading"><div><p className="eyebrow">KEEP THE GOOD THINGS COMING</p><h2 id="related-title">A few more little favorites<span>.</span></h2></div><Link href="/search" className="archive-link">Explore the archive <ArrowUpRight size={16} aria-hidden="true" /></Link></div><div className="discovery-grid">{related.map((entry) => <CatalogCard key={entry.item.id} item={entry} />)}</div></section>}
    </main>
    <footer className="home-footer home-shell"><Link href="/" className="footer-logo">pixinium<span>.</span></Link><p>A little archive. A lot to love.</p><Link href="/search">Back to the good stuff ↑</Link></footer>
  </div>
}
