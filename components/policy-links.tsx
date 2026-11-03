import Link from 'next/link'
import { POLICIES, policyHref } from '@/lib/policies'

const groups = [
  { title: 'Pixinium', slugs: ['terms', 'acceptable-use', 'contact'] },
  { title: 'Your privacy', slugs: ['privacy', 'cookies'] },
  { title: 'For creators', slugs: ['usage-rights', 'copyright'] },
] as const

export function PolicyLinks() {
  return <nav className="policy-links" aria-label="Policies and support">
    {groups.map(group => <div className="policy-link-group" key={group.title}>
      <h2>{group.title}</h2>
      <ul>{group.slugs.map(slug => {
        const policy = POLICIES.find(item => item.slug === slug)!
        return <li key={slug}><Link href={policyHref(slug)}>{policy.label}</Link></li>
      })}</ul>
    </div>)}
  </nav>
}
