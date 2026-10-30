import assert from 'node:assert/strict'
import test from 'node:test'
import { strFromU8, unzipSync } from 'fflate'
import { createStoryEpub } from '../server/services/story-epub'

test('story EPUB is a valid archive with an uncompressed mimetype first and ordered chapters', async () => {
  const epub = await createStoryEpub('A <quiet> story', [
    { chapterNumber: 2, contentMarkdown: '# Second chapter\n\n<script>alert("unsafe")</script>\n\n**The end.**' },
    { chapterNumber: 1, contentMarkdown: '# First chapter\n\nA calm beginning.' },
  ], 'A & B')

  assert.deepEqual(Array.from(epub.slice(0, 4)), [0x50, 0x4b, 0x03, 0x04])
  assert.equal(epub[8] | (epub[9] << 8), 0)
  const firstNameLength = epub[26] | (epub[27] << 8)
  assert.equal(strFromU8(epub.slice(30, 30 + firstNameLength)), 'mimetype')

  const files = unzipSync(epub)
  assert.equal(strFromU8(files.mimetype), 'application/epub+zip')
  const packageDocument = strFromU8(files['OEBPS/content.opf'])
  assert.ok(packageDocument.indexOf('chapter-1.xhtml') < packageDocument.indexOf('chapter-2.xhtml'))
  assert.match(packageDocument, /A &amp; B/)
  const secondChapter = strFromU8(files['OEBPS/chapter-2.xhtml'])
  assert.match(secondChapter, /&lt;script&gt;alert\(&quot;unsafe&quot;\)&lt;\/script&gt;/)
  assert.match(secondChapter, /<strong>The end\.<\/strong>/)
  assert.match(strFromU8(files['OEBPS/nav.xhtml']), /A &lt;quiet&gt; story/)
})
