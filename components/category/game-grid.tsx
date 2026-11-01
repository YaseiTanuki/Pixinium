import { CatalogCard } from '@/components/catalog-card'
import { MotionDiv, Reveal, popIn } from '@/components/motion'
import type { CatalogDetail } from '@/lib/entities/catalog'
import './game-cartridge.css'

export function GameGrid({ items }: { items: CatalogDetail[] }) {
  return <Reveal step={0.05} className="category-game-grid">{items.map(item => <MotionDiv key={item.item.id} variants={popIn}><CatalogCard item={item} variant="cartridge" /></MotionDiv>)}</Reveal>
}
