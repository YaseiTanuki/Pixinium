import { Sparkles } from 'lucide-react'
import Link from 'next/link'
import type { CatalogDetail } from '@/lib/entities/catalog'
import { ItemActions } from './item-actions'

export function ItemInformation({ item }: { item: CatalogDetail }) {
  return (
    <section className="detail-copy" aria-labelledby="item-title">
      <p className="eyebrow"><span className="status-dot" />{item.category.name}</p>
      <h1 id="item-title">{item.item.title}</h1>
      {item.item.summary && <p className="detail-description">{item.item.summary}</p>}
      {(item.tags.length > 0 || item.item.isFeatured) && <div className="detail-tags">
        {item.item.isFeatured && <span><Sparkles size={12} aria-hidden="true" /> Pixinium pick</span>}
        {item.tags.map(tag => <span key={tag.id}>{tag.name}</span>)}
      </div>}
      <div className="detail-purchase">
        {item.facts.length > 0 && <dl className="detail-facts">
          {item.facts.map(fact => (
            <div key={fact.key}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>
          ))}
        </dl>}
        <ItemActions item={item} />
        <p className="detail-policy-note"><Link href="/policies/usage-rights">Check usage rights</Link><span aria-hidden="true"> · </span><Link href="/policies/contact#abuse-and-security-concerns">Report an issue</Link></p>
      </div>
    </section>
  )
}
