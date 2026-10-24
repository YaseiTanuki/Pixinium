import Link from 'next/link'

export default function ItemNotFound() {
  return <main className="home-page"><div className="home-shell collection-empty" style={{ paddingBlock: 100 }}><p className="eyebrow">A LITTLE DETOUR</p><h1>This find has wandered off.</h1><p>The item may have moved. There are more good things in the archive.</p><Link href="/search" className="primary-button">Explore the archive</Link></div></main>
}
