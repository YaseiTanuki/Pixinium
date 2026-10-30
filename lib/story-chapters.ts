export const MAX_STORY_CHAPTER_BYTES = 512 * 1024

export function storyChapterTitle(markdown: string, chapterNumber: number) {
  const heading = markdown.match(/^\s*#\s+(.+?)\s*#*\s*$/m)?.[1]?.trim()
  return heading || `Chapter ${chapterNumber}`
}

export function storyChapterBody(markdown: string) {
  return markdown.replace(/^\s*#\s+.+?\s*#*\s*(?:\r?\n|$)/m, '').trim()
}
