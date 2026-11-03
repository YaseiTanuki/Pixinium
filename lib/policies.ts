export const POLICY_RELEASE = {
  version: '1.0',
  effectiveDate: '2026-11-03',
  updatedAt: '2026-11-03',
} as const

export const POLICY_CONTACT = {
  operator: 'Tanuki',
  country: 'Vietnam',
  support: 'support@pixinium.com',
  privacy: 'privacy@pixinium.com',
  copyright: 'copyright@pixinium.com',
} as const

export const POLICIES = [
  { slug: 'terms', label: 'Terms', title: 'Terms of Service', description: 'The terms for accounts, downloads and using Pixinium.' },
  { slug: 'privacy', label: 'Privacy', title: 'Privacy Policy', description: 'What information Pixinium uses, why we use it and your choices.' },
  { slug: 'copyright', label: 'Copyright', title: 'Copyright & Takedown Policy', description: 'Report copyright concerns or ask us to review a removal.' },
  { slug: 'acceptable-use', label: 'Content Policy', title: 'Acceptable Use & Content Policy', description: 'Help keep the archive safe, lawful and respectful.' },
  { slug: 'cookies', label: 'Cookies', title: 'Cookie Policy', description: 'How cookies, browser storage and analytics work on Pixinium.' },
  { slug: 'usage-rights', label: 'Usage Rights', title: 'Asset Usage Rights', description: 'Check permissions before using, modifying or sharing a download.' },
  { slug: 'contact', label: 'Contact', title: 'Contact Pixinium', description: 'Get help, exercise your privacy rights or report a concern.' },
] as const

export type PolicySlug = typeof POLICIES[number]['slug']

export function findPolicy(slug: string) {
  return POLICIES.find(policy => policy.slug === slug)
}

export function policyHref(slug: PolicySlug) {
  return `/policies/${slug}`
}
