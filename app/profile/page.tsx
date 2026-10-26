import Link from 'next/link'
import { ArrowUpRight, BadgeCheck, CalendarDays, LogOut, Mail, Upload, UserRound } from 'lucide-react'
import { requireAccount } from '@/server/services/auth.service'
import { hasPermission } from '@/lib/auth/permissions'
import { logout } from '@/app/actions/auth'
import { listCatalogItems } from '@/server/services/catalog.service'
import { UsernameForm } from '@/components/username-form'
import { ProfileAvatar } from '@/components/profile-avatar'
import { ProfileCollection } from '@/components/profile-collection'

export const dynamic = 'force-dynamic'

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ access?: string }> }) {
  const account = await requireAccount()
  const { access } = await searchParams
  const catalog = await listCatalogItems().then(items => ({ items, unavailable: false })).catch(() => ({ items: [], unavailable: true }))
  const name = account.username || account.displayName || 'Pixinium member'
  const joined = new Date(account.joinedAt)
  const joinedLabel = Number.isNaN(joined.getTime()) ? null : new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(joined)

  return <div className="workspace-page profile-page">
    {access === 'denied' && <p role="alert" className="account-notice">You don’t have access to that area.</p>}
    {!account.username && <section className="profile-info-card"><h2>Finish setting up your account</h2><p>Your account needs an available username.</p><UsernameForm /></section>}
    <header className="profile-identity">
      <ProfileAvatar name={name} url={account.avatarUrl} />
      <div className="profile-identity-copy"><p className="profile-kicker">YOUR PROFILE</p><h1>{name}</h1><p className="profile-email"><Mail size={15} aria-hidden="true" /><span>{account.email}</span></p><span className="profile-verified"><BadgeCheck size={14} aria-hidden="true" /> Email verified</span></div>
      <Link className="profile-browse" href="/search">Explore the archive <ArrowUpRight size={16} aria-hidden="true" /></Link>
    </header>
    <div className="profile-content-grid">
      <ProfileCollection items={catalog.items.map(({ item, category, cover, facts }) => ({ item, category, cover, facts }))} unavailable={catalog.unavailable} />
      <aside className="profile-sidebar" aria-label="Account details and actions">
        <section className="profile-info-card"><h2>Account details</h2><dl>
          <div><dt><UserRound size={14} aria-hidden="true" /> Username</dt><dd>{account.username ?? 'Not chosen yet'}</dd></div>
          <div><dt><Mail size={14} aria-hidden="true" /> Email address</dt><dd>{account.email}</dd></div>
          {joinedLabel && <div><dt><CalendarDays size={14} aria-hidden="true" /> Joined Pixinium</dt><dd><time dateTime={account.joinedAt}>{joinedLabel}</time></dd></div>}
        </dl><form action={logout}><button className="profile-signout"><LogOut size={15} aria-hidden="true" /> Sign out</button></form></section>
        {hasPermission(account.role, 'admin:access') && <section className="profile-studio-card"><span className="profile-studio-icon"><Upload size={19} aria-hidden="true" /></span><h2>Add to the archive</h2><p>Upload a new find, prepare its details and share it with everyone.</p><Link href="/admin">Open admin studio <ArrowUpRight size={16} aria-hidden="true" /></Link></section>}
        <section className="profile-note"><h2>A collection that feels like you.</h2><p>Fresh screens, good sounds and tiny escapes. Keep the ones you want to come back to.</p></section>
      </aside>
    </div>
  </div>
}
