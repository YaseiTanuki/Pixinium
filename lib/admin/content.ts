import { z } from 'zod'

export const MAX_CONTENT_FILE_BYTES = 50 * 1024 * 1024
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
const slug = z.string().min(1).max(120).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
export const attachmentSchema = z.object({
  path: z.string().max(200).regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]+$/),
  altText: z.string().trim().max(300),
  focalX: z.number().min(0).max(100).default(50), focalY: z.number().min(0).max(100).default(50),
}).transform(attachment => ({ ...attachment, role: 'download' as const }))
export const contentSchema = z.object({
  categoryId: z.string().regex(/^[1-9][0-9]*$/),
  title: z.string().trim().min(1).max(200), summary: z.string().trim().max(500),
  description: z.string().trim().max(20000), status: z.literal('published').default('published'),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/), isFeatured: z.boolean(),
  sortOrder: z.number().int().min(0).max(2147483647),
  metadata: z.record(z.string(), z.unknown()),
  uses: z.array(slug).max(20).default([]),
  tags: z.array(z.object({ slug, name: z.string().trim().min(1).max(60) })).max(20),
  facts: z.array(z.object({ key: z.string().regex(/^[a-z][a-z0-9_]*$/).max(64),
    label: z.string().trim().min(1).max(80), value: z.string().trim().min(1).max(300) })).max(20),
  attachments: z.array(attachmentSchema).max(12),
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
