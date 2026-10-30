import { randomUUID } from 'node:crypto'
import { Zip, ZipDeflate, ZipPassThrough, strToU8 } from 'fflate'
import { storyChapterBody, storyChapterTitle } from '@/lib/story-chapters'
import { renderStoryMarkdown } from '@/lib/story-markdown'

export type EpubChapter = { chapterNumber: number; contentMarkdown: string }

function xml(value: string) {
  return value.replace(/[<>&"']/g, character => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
  })[character]!)
}

function buildPackage(title: string, chapters: EpubChapter[], author?: string) {
  const orderedChapters = [...chapters].sort((a, b) => a.chapterNumber - b.chapterNumber)
  const identifier = `urn:uuid:${randomUUID()}`
  const manifest = orderedChapters.map(chapter =>
    `<item id="chapter-${chapter.chapterNumber}" href="chapter-${chapter.chapterNumber}.xhtml" media-type="application/xhtml+xml"/>`).join('')
  const spine = orderedChapters.map(chapter => `<itemref idref="chapter-${chapter.chapterNumber}"/>`).join('')
  const nav = orderedChapters.map(chapter =>
    `<li><a href="chapter-${chapter.chapterNumber}.xhtml">${xml(storyChapterTitle(chapter.contentMarkdown, chapter.chapterNumber))}</a></li>`).join('')
  const chapterFiles = orderedChapters.map(chapter => {
    const body = renderStoryMarkdown(storyChapterBody(chapter.contentMarkdown))
    const chapterTitle = storyChapterTitle(chapter.contentMarkdown, chapter.chapterNumber)
    return [`OEBPS/chapter-${chapter.chapterNumber}.xhtml`,
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head>` +
      `<title>${xml(chapterTitle)}</title><meta charset="utf-8"/></head><body>` +
      `<h1>${xml(chapterTitle)}</h1>${body}</body></html>`]
  })
  const opf = `<?xml version="1.0" encoding="UTF-8"?>` +
    `<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">` +
    `<metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">${identifier}</dc:identifier>` +
    `<dc:title>${xml(title)}</dc:title>${author ? `<dc:creator>${xml(author)}</dc:creator>` : ''}` +
    `<dc:language>vi</dc:language><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}</meta></metadata>` +
    `<manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>` +
    `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>${manifest}</manifest>` +
    `<spine toc="ncx">${spine}</spine></package>`
  const navFile = `<?xml version="1.0" encoding="UTF-8"?>` +
    `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head>` +
    `<title>${xml(title)}</title></head><body><nav epub:type="toc" id="toc"><h1>Contents</h1><ol>${nav}</ol></nav></body></html>`
  const ncx = `<?xml version="1.0" encoding="UTF-8"?>` +
    `<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head>` +
    `<meta name="dtb:uid" content="${identifier}"/></head><docTitle><text>${xml(title)}</text></docTitle><navMap>` +
    orderedChapters.map((chapter, index) => `<navPoint id="nav-${chapter.chapterNumber}" playOrder="${index + 1}">` +
      `<navLabel><text>${xml(storyChapterTitle(chapter.contentMarkdown, chapter.chapterNumber))}</text></navLabel>` +
      `<content src="chapter-${chapter.chapterNumber}.xhtml"/></navPoint>`).join('') +
    `</navMap></ncx>`

  return [
    ['META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>` +
      `<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles>` +
      `<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`],
    ['OEBPS/content.opf', opf],
    ['OEBPS/nav.xhtml', navFile],
    ['OEBPS/toc.ncx', ncx],
    ...chapterFiles,
  ] as const
}

export async function createStoryEpub(title: string, chapters: EpubChapter[], author?: string) {
  const files = buildPackage(title, chapters, author)
  return new Promise<Uint8Array>((resolve, reject) => {
    const chunks: Uint8Array[] = []
    const zip = new Zip((error, chunk, final) => {
      if (error) {
        reject(error)
        return
      }
      chunks.push(chunk)
      if (final) {
        const output = new Uint8Array(chunks.reduce((size, current) => size + current.length, 0))
        let offset = 0
        for (const current of chunks) {
          output.set(current, offset)
          offset += current.length
        }
        resolve(output)
      }
    })
    const mimetype = new ZipPassThrough('mimetype')
    zip.add(mimetype)
    mimetype.push(strToU8('application/epub+zip'), true)
    for (const [path, content] of files) {
      const entry = new ZipDeflate(path, { level: 6 })
      zip.add(entry)
      entry.push(strToU8(content), true)
    }
    zip.end()
  })
}
