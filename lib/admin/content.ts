import { z } from 'zod'
import { CONTENT_LIMITS, MAX_ATTACHMENT_COUNT } from './limits'
import { MAX_STORY_CHAPTER_BYTES } from '../story-chapters'
export { MAX_CONTENT_FILE_BYTES } from './limits'

export const fileTypes: Record<string, { mime: string; mediaType: 'image' | 'audio' | 'video' | 'file' }> = {
  png: { mime: 'image/png', mediaType: 'image' }, jpg: { mime: 'image/jpeg', mediaType: 'image' },
  jpeg: { mime: 'image/jpeg', mediaType: 'image' }, webp: { mime: 'image/webp', mediaType: 'image' },
  avif: { mime: 'image/avif', mediaType: 'image' }, mp3: { mime: 'audio/mpeg', mediaType: 'audio' },
  wav: { mime: 'audio/wav', mediaType: 'audio' }, flac: { mime: 'audio/flac', mediaType: 'audio' },
  ogg: { mime: 'audio/ogg', mediaType: 'audio' }, aac: { mime: 'audio/aac', mediaType: 'audio' },
  mp4: { mime: 'video/mp4', mediaType: 'video' }, webm: { mime: 'video/webm', mediaType: 'video' },
  zip: { mime: 'application/zip', mediaType: 'file' }, pdf: { mime: 'application/pdf', mediaType: 'file' },
}
export function fileType(name: string) {
  const extension = name.split('.').pop()?.toLowerCase() ?? ''
  return Object.hasOwn(fileTypes, extension) ? { extension, ...fileTypes[extension] } : null
}

export function acceptedFileTypes(mediaType?: 'image' | 'audio' | 'video' | 'file') {
  return Object.entries(fileTypes)
    .filter(([, type]) => !mediaType || type.mediaType === mediaType)
    .map(([extension]) => `.${extension}`).join(',')
}

export function validateStoryContent(attachments: AttachmentInput[]) {
  if (attachments.length !== 1 || fileType(attachments[0].path)?.mediaType !== 'image') {
    return 'Upload one image to use as the book cover.'
  }
  return null
}

const slug = z.string().min(1).max(120).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
export const attachmentSchema = z.object({
  path: z.string().max(200).regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]+$/),
  altText: z.string().trim().max(CONTENT_LIMITS.attachmentLabel),
  role: z.enum(['cover', 'download']).default('download'),
  fileName: z.string().trim().min(1).max(255).optional(),
  focalX: z.number().min(0).max(100).default(50), focalY: z.number().min(0).max(100).default(50),
})
export const contentSchema = z.object({
  categoryId: z.string().regex(/^[1-9][0-9]*$/),
  title: z.string().trim().min(1).max(CONTENT_LIMITS.title), summary: z.string().trim().max(CONTENT_LIMITS.summary),
  description: z.string().trim().max(CONTENT_LIMITS.description).default(''), status: z.literal('published').default('published'),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#f1e5dd'), isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(CONTENT_LIMITS.sortOrder).default(0),
  metadata: z.record(z.string(), z.unknown()),
  initialChapter: z.object({
    chapterNumber: z.number().int().min(1).max(100_000),
    contentMarkdown: z.string().min(1).max(MAX_STORY_CHAPTER_BYTES),
  }).optional(),
  uses: z.array(slug).max(20).default([]),
  tags: z.array(z.object({ slug, name: z.string().trim().min(1).max(60) })).max(20),
  facts: z.array(z.object({ key: z.string().regex(/^[a-z][a-z0-9_]*$/).max(CONTENT_LIMITS.factKey),
    label: z.string().trim().min(1).max(CONTENT_LIMITS.factLabel), value: z.string().trim().min(1).max(CONTENT_LIMITS.factValue) })).max(CONTENT_LIMITS.facts),
  attachments: z.array(attachmentSchema).max(MAX_ATTACHMENT_COUNT),
}).superRefine((value, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message })
  if (new Set(value.facts.map(x => x.key)).size !== value.facts.length) issue('Fact keys must be unique.')
  if (new Set(value.tags.map(x => x.slug)).size !== value.tags.length) issue('Tags must be unique.')
  if (new Set(value.uses).size !== value.uses.length) issue('Choose each use only once.')
  if (new Set(value.attachments.map(x => x.path)).size !== value.attachments.length) issue('Each file can be attached once.')
  if (value.status === 'published' && !value.attachments.some(x => fileType(x.path)?.mediaType === 'image')) issue('Upload an image to generate a thumbnail before publishing.')
  for (const asset of value.attachments) {
    const type = fileType(asset.path)
    if (!type) issue('Unsupported file type.')
    if (type?.mediaType === 'image' && !asset.altText) issue('Describe each uploaded image.')
  }
})
export type ContentInput = z.infer<typeof contentSchema>
export type AttachmentInput = z.infer<typeof attachmentSchema>
export type ContentResult = { error?: string; message?: string; href?: string; id?: string; slug?: string; category?: string }
