'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowUpRight, Heart } from 'lucide-react'
import { ItemArtwork } from '@/components/catalog-card'
import { CollectButton } from '@/components/collect-button'
import { MasonryGrid } from '@/components/masonry-grid'
import { categoryIcon } from '@/lib/category-icons'
import { contentKind } from '@/lib/content-types'
import { categoryHref, itemHref } from '@/lib/catalog'
import type { CatalogCard, Category } from '@/lib/entities/catalog'
import styles from './collection-browser.module.css'

export type CollectionCategory = Pick<Category, 'id' | 'name' | 'iconKey' | 'metadataSchemaKey' | 'slug'>

function SavedEntry({ item, kind }: { item: CatalogCard; kind: string }) {
  return <article className={styles.entry} data-kind={kind}>
    <Link href={itemHref(item)} prefetch={false} className={styles.artwork} aria-label={`Open ${item.item.title}`}><ItemArtwork item={item} naturalSize={kind === 'image'} /></Link>
    <div className={styles.entryBody}>
      <h4><Link href={itemHref(item)} prefetch={false}>{item.item.title}</Link></h4>
      {kind !== 'image' && <p>{item.facts.slice(0, 2).map(fact => fact.value).join(' · ') || item.category.name}</p>}
      <CollectButton item={item} className={styles.save} />
    </div>
  </article>
}

export function CollectionBrowser({ items, categories }: { items: CatalogCard[]; categories: CollectionCategory[] }) {
  const [selected, setSelected] = useState<string | null>(null)
  const active = categories.find(category => category.id === selected)
  const visible = active ? items.filter(item => item.category.id === active.id) : []
  const kind = contentKind(active?.metadataSchemaKey)
  return <div className={styles.browser}>
    <div className={styles.categories} role="group" aria-label="Browse saved finds by category">
      {categories.map(category => {
        const Icon = categoryIcon(category.iconKey)
        const count = items.filter(item => item.category.id === category.id).length
        return <button key={category.id} type="button" className={styles.category} data-kind={contentKind(category.metadataSchemaKey)} aria-pressed={selected === category.id} aria-controls="saved-category-content" onClick={() => setSelected(category.id)}>
          <Icon size={23} aria-hidden="true" /><span className={styles.categoryName}>{category.name}</span><span className={styles.count}>{count}<span className={styles.countLabel}> saved</span></span>
        </button>
      })}
    </div>
    <div id="saved-category-content" className={styles.results}>
      {active ? <>
        <div className={styles.heading}><h3>{active.name}<span>{visible.length} saved</span></h3><Link href={categoryHref(active.slug)}>Find more <ArrowUpRight size={15} aria-hidden="true" /></Link></div>
        {visible.length ? kind === 'image'
          ? <MasonryGrid className={styles.masonry}>{visible.map(item => <SavedEntry key={item.item.id} item={item} kind={kind} />)}</MasonryGrid>
          : <div className={styles.items} data-kind={kind}>{visible.map(item => <SavedEntry key={item.item.id} item={item} kind={kind} />)}</div>
          : <div className={styles.empty}><Heart size={23} aria-hidden="true" /><h4>No saved {active.name.toLowerCase()} yet.</h4><p>Collect something you love and it will appear here.</p><Link href={categoryHref(active.slug)}>Explore {active.name.toLowerCase()} <ArrowUpRight size={15} aria-hidden="true" /></Link></div>}
      </> : <p className={styles.prompt}>Choose a category to look through your saved finds.</p>}
    </div>
  </div>
}
