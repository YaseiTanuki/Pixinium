import { PageTransition } from '@/components/page-transition'
import Link from '@/components/navigation-link'

export default function ItemNotFound() {
  return <PageTransition className="home-page"><div className="home-shell collection-empty" style={{ paddingBlock: 100 }}><p className="eyebrow">A LITTLE DETOUR</p><h1>This find has wandered off.</h1><p>The item may have moved. There are more good things in the Mine.</p><Link href="/search" className="primary-button">Explore the Mine</Link></div></PageTransition>
}
