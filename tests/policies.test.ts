import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PolicyContent } from '../components/policy-content'
import { POLICIES, POLICY_CONTACT, findPolicy, policyHref } from '../lib/policies'
import { parsePolicyMarkdown, policyLinkAllowed } from '../lib/policy-markdown'
import { POLICY_SOURCES } from '../lib/generated/site-assets'

test('policy lookup rejects unknown names rather than resolving arbitrary files', () => {
  for (const slug of ['../terms', '__proto__', 'constructor', 'missing']) {
    assert.equal(findPolicy(slug), undefined)
  }
  assert.equal(findPolicy('privacy')?.title, 'Privacy Policy')
})

test('policy rendering escapes HTML and does not activate unsafe links', () => {
  const source = '## Safety\n\n<script>alert(1)</script> [unsafe](javascript:alert) [valid](/policies/privacy)\n\n- First\n- Second'
  const html = renderToStaticMarkup(createElement(PolicyContent, { sections: parsePolicyMarkdown(source) }))
  assert.ok(!html.includes('<script>'))
  assert.ok(!html.includes('href="javascript:'))
  assert.ok(html.includes('href="/policies/privacy"'))
  assert.ok(html.includes('<ul>'))
  for (const href of ['//evil.test', 'data:text/html,bad', 'javascript:alert(1)', '/policies/../admin']) {
    assert.equal(policyLinkAllowed(href), false)
  }
})

test('every policy has readable source, working section anchors and resolvable policy links', async () => {
  const documents = new Map<string, ReturnType<typeof parsePolicyMarkdown>>()
  for (const policy of POLICIES) {
    const source = await readFile(new URL(`../content/policies/${policy.slug}.md`, import.meta.url), 'utf8')
    assert.equal(POLICY_SOURCES[policy.slug], source.replace(/\r\n/g, '\n'), `Stale bundled policy: ${policy.slug}`)
    const sections = parsePolicyMarkdown(source)
    assert.ok(sections.length > 0)
    assert.ok(sections.every(section => section.blocks.length > 0))
    documents.set(policyHref(policy.slug), sections)
  }
  for (const sections of documents.values()) {
    const text = JSON.stringify(sections)
    for (const match of text.matchAll(/\]\((\/policies\/[a-z-]+)(?:#([a-z0-9-]+))?\)/g)) {
      const target = documents.get(match[1])
      assert.ok(target, `Unknown policy link: ${match[1]}`)
      if (match[2]) assert.ok(target.some(section => section.id === match[2]), `Missing anchor: ${match[2]}`)
    }
  }
  const contact = await readFile(new URL('../content/policies/contact.md', import.meta.url), 'utf8')
  for (const email of [POLICY_CONTACT.support, POLICY_CONTACT.privacy, POLICY_CONTACT.copyright]) {
    assert.ok(contact.includes(`mailto:${email}`))
  }
})
