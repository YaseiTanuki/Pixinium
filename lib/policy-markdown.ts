// Deliberately limited to source-authored headings, paragraphs, lists and links.
// Raw HTML is rendered as text; there is no executable MDX or HTML injection.
export type PolicyBlock = { type: 'paragraph'; text: string } | { type: 'list'; items: string[] }
export type PolicySection = { id: string; title: string; blocks: PolicyBlock[] }

export function policyLinkAllowed(href: string): boolean {
  return /^\/policies\/[a-z-]+(?:#[a-z0-9-]+)?$/.test(href)
    || /^mailto:[a-z0-9._%+-]+@pixinium\.com$/i.test(href)
    || /^https:\/\/[^\s<>]+$/i.test(href)
}

export function parsePolicyMarkdown(source: string): PolicySection[] {
  const sections: PolicySection[] = []
  for (const block of source.trim().split(/\r?\n\s*\r?\n/)) {
    if (block.startsWith('## ')) {
      const title = block.slice(3).trim()
      const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      if (!id || sections.some(section => section.id === id)) throw new Error('Policy headings must have unique anchors.')
      sections.push({ id, title, blocks: [] })
      continue
    }
    const section = sections.at(-1)
    if (!section) throw new Error('Policy content must start with a level-two heading.')
    const lines = block.split(/\r?\n/)
    if (lines.every(line => line.startsWith('- '))) {
      section.blocks.push({ type: 'list', items: lines.map(line => line.slice(2)) })
    } else {
      section.blocks.push({ type: 'paragraph', text: lines.join(' ') })
    }
  }
  return sections
}
