import { CatalogCard } from '@/components/catalog-card'
import type { CatalogDetail } from '@/lib/entities/catalog'
import './game-cartridge.css'

export function GameGrid({ items }: { items: CatalogDetail[] }) {
  return <div className="category-game-grid">{items.map(item => <CatalogCard key={item.item.id} item={item} variant="cartridge" />)}</div>
}
