'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowUpRight, Heart } from 'lucide-react'
import { ItemArtwork } from '@/components/catalog-card'
import { CollectButton } from '@/components/collect-button'
import { MasonryGrid } from '@/components/masonry-grid'
import { contentKind } from '@/lib/content-types'
import { itemHref } from '@/lib/catalog'
import type { CatalogCard, Category } from '@/lib/entities/catalog'
import { CatalogFilters } from '@/components/catalog-filters'
import { filterSavedItems, COLLECTION_SORT_OPTIONS, type SavedCatalogCard } from '@/lib/collection-filters'
import type { CatalogFilterValues } from '@/lib/search-filters'
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

const EMPTY_FILTERS: CatalogFilterValues = { category: '', tag: '', sort: '', tagMatch: 'all', query: '' }

export function CollectionBrowser({ items, categories }: { items: SavedCatalogCard[]; categories: CollectionCategory[] }) {
  const [applied, setApplied] = useState(EMPTY_FILTERS)
  const visible = filterSavedItems(items, applied)
  const tags = [...new Map(items.flatMap(item => item.tags).map(tag => [tag.slug, tag])).values()].sort((a, b) => a.name.localeCompare(b.name))
  const filtered = Boolean(applied.category || applied.tag || applied.sort || applied.query)
  return <div className={styles.browser}>
    <CatalogFilters categories={categories} tags={tags} applied={applied} onApply={setApplied} search={{ placeholder: 'Search your saved finds' }} sortOptions={COLLECTION_SORT_OPTIONS}>
      <div className={styles.heading}><h3>Saved finds<span role="status">{visible.length} of {items.length}</span></h3><Link href="/search">Find more <ArrowUpRight size={15} aria-hidden="true" /></Link></div>
    </CatalogFilters>
    <div id="saved-category-content" className={styles.results}>
      {visible.length ? <MasonryGrid className={styles.masonry}>{visible.map(item => {
        const category = categories.find(category => category.id === item.category.id)
        return <SavedEntry key={item.item.id} item={item} kind={contentKind(category?.metadataSchemaKey)} />
      })}</MasonryGrid> : <div className={styles.empty}><Heart size={23} aria-hidden="true" /><h4>{filtered ? 'No saved finds match these filters.' : 'No saved finds yet.'}</h4><p>{filtered ? 'Try other tags or clear your filters to see your collection.' : 'Collect something you love and it will appear here.'}</p>{filtered ? <button type="button" onClick={() => setApplied(EMPTY_FILTERS)}>Clear filters</button> : <Link href="/search">Explore the archive <ArrowUpRight size={15} aria-hidden="true" /></Link>}</div>}
    </div>
  </div>
}
