import Image from 'next/image'
import Link from 'next/link'

export function BrandLogo({ className = '' }: { className?: string }) {
  return <Link href="/" className={`brand-logo ${className}`} aria-label="Pixinium home" translate="no">
    <Image className="brand-logo-mark" src="/brand/pixinium-crystal.svg" width={40} height={40} alt="" unoptimized />
    <span className="brand-logo-name">pixinium<span className="brand-logo-dot">.</span></span>
  </Link>
}
