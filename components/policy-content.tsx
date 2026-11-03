import { Fragment } from 'react'
import { policyLinkAllowed, type PolicySection } from '@/lib/policy-markdown'

function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g)
  return <>{parts.map((part, index) => {
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)
    return link && policyLinkAllowed(link[2])
      ? <a key={index} href={link[2]}>{link[1]}</a>
      : <Fragment key={index}>{part}</Fragment>
  })}</>
}

export function PolicyContent({ sections }: { sections: PolicySection[] }) {
  return <div className="policy-prose">{sections.map(section => <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`}>
    <h2 id={`${section.id}-heading`}>{section.title}</h2>
    {section.blocks.map((block, index) => block.type === 'list'
      ? <ul key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}><InlineText text={item} /></li>)}</ul>
      : <p key={index}><InlineText text={block.text} /></p>)}
  </section>)}</div>
}
