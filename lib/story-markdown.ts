import MarkdownIt from 'markdown-it'

const markdown = new MarkdownIt({ html: false, linkify: false, xhtmlOut: true })

export function renderStoryMarkdown(source: string) {
  return markdown.render(source)
}
