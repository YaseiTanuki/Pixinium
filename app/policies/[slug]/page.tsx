import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PolicyContent } from '@/components/policy-content'
import { POLICIES, POLICY_CONTACT, POLICY_RELEASE, findPolicy, policyHref } from '@/lib/policies'
import { parsePolicyMarkdown } from '@/lib/policy-markdown'
import { pageMetadata } from '@/lib/seo'
import { POLICY_SOURCES } from '@/lib/generated/site-assets'

export const dynamicParams = false

export function generateStaticParams() {
  return POLICIES.map(({ slug }) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const policy = findPolicy(slug)
  if (!policy) notFound()
  return pageMetadata({ title: policy.title, description: policy.description, path: policyHref(policy.slug) })
}

function dateLabel(date: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const policy = findPolicy(slug)
  if (!policy) notFound()
  const source = POLICY_SOURCES[policy.slug]
  const sections = parsePolicyMarkdown(source)

  return <>
    <header className="policy-heading">
      <h1>{policy.title}</h1>
      <p>{policy.description}</p>
      <dl className="policy-meta">
        <div><dt>Version</dt><dd>{POLICY_RELEASE.version}</dd></div>
        <div><dt>Effective</dt><dd><time dateTime={POLICY_RELEASE.effectiveDate}>{dateLabel(POLICY_RELEASE.effectiveDate)}</time></dd></div>
        <div><dt>Updated</dt><dd><time dateTime={POLICY_RELEASE.updatedAt}>{dateLabel(POLICY_RELEASE.updatedAt)}</time></dd></div>
      </dl>
    </header>
    <div className="policy-reading-layout">
      <aside className="policy-navigation">
        <nav aria-label="Policies">{POLICIES.map(item => <Link key={item.slug} href={policyHref(item.slug)} aria-current={item.slug === slug ? 'page' : undefined}>{item.label}</Link>)}</nav>
        <details className="policy-toc"><summary>On this page</summary><nav aria-label="On this page">{sections.map(section => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}</nav></details>
      </aside>
      <article aria-label={policy.title}>
        <PolicyContent sections={sections} />
        <p className="policy-operator">Operated by {POLICY_CONTACT.operator} · {POLICY_CONTACT.country}. <Link href={policyHref('contact')}>Contact Pixinium</Link></p>
      </article>
    </div>
  </>
}
