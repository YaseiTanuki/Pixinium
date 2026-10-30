import type { CatalogDetail, StoryChapter } from '@/lib/entities/catalog'
import { Download, Sparkles } from 'lucide-react'
import { renderStoryMarkdown } from '@/lib/story-markdown'
import { storyChapterBody, storyChapterTitle } from '@/lib/story-chapters'

export function StoryReader({ item, chapters }: { item: CatalogDetail; chapters: StoryChapter[] }) {
  const epubHref = `/items/${encodeURIComponent(item.category.slug)}/${encodeURIComponent(item.item.slug)}/epub`
  return <article className="story-reader" aria-labelledby="story-reader-title">
    <header>
      <div><p className="eyebrow"><Sparkles size={13} aria-hidden="true" /> YOUR STORY NOOK</p><h2 id="story-reader-title">Settle in<span>.</span></h2><p className="story-reader-subtitle">A little quiet, just for you.</p></div>
      {chapters.length > 0 && <a className="detail-download-button story-epub-download" href={epubHref}><Download size={15} aria-hidden="true" /> Download the book</a>}
    </header>
    {chapters.length ? <div className="story-reader-chapters">
      {chapters.map(chapter => <section className="story-reader-chapter" key={chapter.chapterNumber}>
        <p className="story-chapter-kicker"><span>CHAPTER {String(chapter.chapterNumber).padStart(2, '0')}</span><span aria-hidden="true">✦</span></p>
        <h3>{storyChapterTitle(chapter.contentMarkdown, chapter.chapterNumber)}</h3>
        <div className="story-reader-text" dangerouslySetInnerHTML={{ __html: renderStoryMarkdown(storyChapterBody(chapter.contentMarkdown)) }} />
      </section>)}
    </div> : <p className="story-reader-empty"><Sparkles size={22} aria-hidden="true" /><span>The first chapter is on its way.</span></p>}
    {chapters.length > 0 && <p className="story-reader-footer"><span aria-hidden="true">✿</span> Take your time. The next page will wait.</p>}
  </article>
}
