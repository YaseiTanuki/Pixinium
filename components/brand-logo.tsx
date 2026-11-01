import Image from 'next/image'
import Link from 'next/link'

export function BrandLogo({ className = '' }: { className?: string }) {
  return <Link href="/" className={`brand-logo ${className}`} aria-label="Pixinium home" translate="no">
    <span className="brand-logo-crystal">
      <Image className="brand-logo-mark" src="/brand/pixinium-crystal.svg" width={40} height={40} alt="" unoptimized />
      <i className="brand-sparkle brand-sparkle-a" aria-hidden="true" />
      <i className="brand-sparkle brand-sparkle-b" aria-hidden="true" />
    </span>
    <span className="brand-logo-name">pixinium<span className="brand-logo-dot">.</span></span>
  </Link>
}
