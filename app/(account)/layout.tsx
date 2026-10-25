import Link from 'next/link'
import { ArrowLeft, Gamepad2, Heart, ImageIcon, Music2, Sparkles } from 'lucide-react'
import './account.css'

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <div className="home-page account-page">
    <a className="skip-home" href="#account-main">Skip to content</a>
    <header className="account-header page-shell">
      <Link href="/" className="home-logo" aria-label="Pixinium home">pixinium<span className="logo-dot">.</span></Link>
      <Link href="/" className="account-back"><ArrowLeft size={15} aria-hidden="true" /> Back to the archive</Link>
    </header>
    <main id="account-main" className="account-shell">
      <aside className="account-intro" aria-label="Your little archive">
        <p className="eyebrow"><span className="status-dot" /> A LITTLE ARCHIVE. A LOT TO LOVE.</p>
        <p className="account-intro-title">Your own<br />little <span className="happy-underline">corner.</span></p>
        <p className="account-intro-copy">A fresh screen. A good soundtrack. A tiny escape.<br />A place for the things that feel like you.</p>
        <div className="account-keepsakes" aria-hidden="true">
          <div className="account-postcard"><span><ImageIcon size={15} /> A FRESH PERSPECTIVE</span><div className="account-landscape"><i /><b /></div><strong>A little room to dream.</strong></div>
          <div className="account-record"><div className="record-disc"><span><Music2 size={24} /></span></div><span>GOOD MOOD, ON REPEAT</span></div>
          <div className="account-stamp"><Sparkles size={21} /><span>GOOD THINGS<br />LIVE HERE.</span></div>
        </div>
        <div className="account-interest-tags"><span><ImageIcon size={13} aria-hidden="true" /> Fresh screens</span><span><Music2 size={13} aria-hidden="true" /> Good sounds</span><span><Gamepad2 size={13} aria-hidden="true" /> Tiny escapes</span></div>
      </aside>
      <section className="account-card">{children}</section>
    </main>
    <footer className="account-footer page-shell"><span>A little archive. A lot to love.</span><span><Heart size={13} aria-hidden="true" /> Make yourself at home.</span></footer>
  </div>
}
