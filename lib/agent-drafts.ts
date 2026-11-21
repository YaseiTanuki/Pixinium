import { z } from 'zod'
import { contentUpdateSchema } from './admin/content'

export const agentItemId = z.string().regex(/^[1-9][0-9]{0,18}$/).refine(value => /^[1-9][0-9]{0,18}$/.test(value) && BigInt(value) <= BigInt('9223372036854775807'), 'Invalid item ID.')
export const agentDraftChanges = z.object({ title: contentUpdateSchema.shape.title, summary: contentUpdateSchema.shape.summary,
  description: contentUpdateSchema.shape.description, tags: contentUpdateSchema.shape.tags,
  facts: contentUpdateSchema.shape.facts, downloadSources: contentUpdateSchema.shape.downloadSources })
  .partial().strict().refine(value => Object.keys(value).length > 0, 'Provide at least one changed field.')
  .superRefine((value, ctx) => {
    if (value.tags && new Set(value.tags.map(tag => tag.slug)).size !== value.tags.length) ctx.addIssue({ code: 'custom', message: 'Tags must be unique.' })
    if (value.facts && new Set(value.facts.map(fact => fact.key)).size !== value.facts.length) ctx.addIssue({ code: 'custom', message: 'Fact keys must be unique.' })
  })
export const agentDraftUpdate = z.object({
  expectedUpdatedAt: z.string().datetime({ offset: true }),
  changes: agentDraftChanges,
}).strict()
