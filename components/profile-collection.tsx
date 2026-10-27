'use client'

import { CATALOG_DISPLAY } from '@/lib/catalog'

import Link from 'next/link'
import { useSyncExternalStore } from 'react'
import { ArrowRight, ArrowUpRight, Heart, Layers3, Monitor } from 'lucide-react'
import { useSavedItems } from '@/lib/saved-items'
import type { CatalogCard as Card } from '@/lib/entities/catalog'
import { CatalogCard } from '@/components/catalog-card'

const subscribe = () => () => {}
const clientSnapshot = () => true
const serverSnapshot = () => false

export function ProfileCollection({ items, unavailable }: { items: Card[]; unavailable: boolean }) {
  const { saved } = useSavedItems()
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot)
  const ids = [...new Set(saved)]
  const byId = new Map(items.map(item => [item.item.id, item]))
  const collection = ids.map(id => byId.get(id)).filter((item): item is Card => Boolean(item))
  const categories = new Set(collection.map(item => item.category.id)).size
  return <section className="profile-library" aria-labelledby="collection-title">
    <div className="profile-metrics" aria-label="Collection overview">
      <div><Heart size={18} aria-hidden="true" /><strong>{hydrated ? ids.length : '—'}</strong><span>Saved finds</span></div>
      <div><Layers3 size={18} aria-hidden="true" /><strong>{hydrated && !unavailable ? categories : '—'}</strong><span>Categories collected</span></div>
      <div><Monitor size={18} aria-hidden="true" /><strong>This device</strong><span>Your collection lives here</span></div>
    </div>
    <div className="profile-section-heading"><div><h2 id="collection-title">Your collection</h2><p>Good finds, kept close.</p></div><Link href="/?collection=saved">View all <ArrowUpRight size={15} aria-hidden="true" /></Link></div>
    {!hydrated ? <p className="profile-collection-placeholder" role="status">Loading your collection…</p>
      : unavailable ? <div className="profile-empty"><Heart size={25} aria-hidden="true" /><h3>Your saved finds are still here.</h3><p>We couldn’t load the archive right now. Try opening your collection again.</p><Link className="account-button" href="/?collection=saved">Open collection <ArrowRight size={15} aria-hidden="true" /></Link></div>
      : collection.length ? <><div className="profile-saved-grid">{collection.slice(0, CATALOG_DISPLAY.savedPreviewItems).map(item => <CatalogCard key={item.item.id} item={item} />)}</div>{ids.length > collection.length && <p className="account-help">Some saved items are no longer available in the archive.</p>}</>
      : <div className="profile-empty"><span className="profile-empty-icon"><Heart size={26} aria-hidden="true" /></span><h3>{ids.length ? 'Find your next favorite.' : 'Start with something you love.'}</h3><p>{ids.length ? 'Your previously saved items are no longer available. Explore the archive for something new.' : 'Tap the heart on a wallpaper, a soundtrack or a game. Your saved finds will appear right here.'}</p><Link className="account-button" href="/search">Explore the archive <ArrowRight size={15} aria-hidden="true" /></Link></div>}
    <p className="profile-device-note"><Monitor size={13} aria-hidden="true" /> Saved on this browser, shared with your collection in the archive.</p>
  </section>
}
