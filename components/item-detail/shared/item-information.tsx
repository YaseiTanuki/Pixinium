import Link from 'next/link'
import { searchHref } from '@/lib/catalog'
import { Sparkles } from 'lucide-react'
import type { CatalogDetail } from '@/lib/entities/catalog'
import { ItemActions } from './item-actions'

export function ItemInformation({ item }: { item: CatalogDetail }) {
  const uses = item.uses.filter(use => use.slug !== item.category.slug)
  return (
    <section className="detail-copy" aria-labelledby="item-title">
      <p className="eyebrow"><span className="status-dot" />{item.category.name}</p>
      {(item.tags.length > 0 || item.item.isFeatured) && <div className="detail-tags">
        {item.item.isFeatured && <span><Sparkles size={12} aria-hidden="true" /> Pixinium pick</span>}
        {item.tags.map(tag => <span key={tag.id}>{tag.name}</span>)}
      </div>}
      <h1 id="item-title">{item.item.title}</h1>
      {uses.length > 0 && (
        <div className="detail-tags" aria-label="Suitable for">
          {uses.map(use => (
            <Link key={use.slug} href={searchHref({ use: use.slug })}>{use.name}</Link>
          ))}
        </div>
      )}
      <div className="detail-purchase">
        <dl className="detail-facts">
          {item.facts.map(fact => (
            <div key={fact.key}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>
          ))}
        </dl>
        <ItemActions item={item} />
      </div>
    </section>
  )
}
