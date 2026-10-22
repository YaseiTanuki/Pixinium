import { z } from 'zod'

// The migration snapshot is explicitly modeled, never a free-form escape hatch.
const legacy = z.strictObject({
  meta: z.string(), color: z.string(), crop: z.string().nullable(), accent: z.enum(['music']).nullable(),
}).optional()
const positiveInteger = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const nonnegativeInteger = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)

export const metadataSchemas = {
  'generic.v1': z.strictObject({ legacy }),
  'wallpapers.v1': z.strictObject({
    legacy,
    width: positiveInteger.optional(),
    height: positiveInteger.optional(),
    image_count: positiveInteger.optional(),
    formats: z.array(z.enum(['png', 'jpg', 'webp', 'avif'])).min(1).optional(),
  }).refine((value) => (value.width === undefined) === (value.height === undefined), {
    message: 'Width and height must be provided together', path: ['height'],
  }),
  'music.v1': z.strictObject({
    legacy,
    track_count: positiveInteger.optional(),
    duration_seconds: nonnegativeInteger.optional(),
    formats: z.array(z.enum(['mp3', 'flac', 'wav', 'ogg', 'aac'])).min(1).optional(),
  }),
  'games.v1': z.strictObject({
    legacy,
    size_bytes: nonnegativeInteger.optional(),
    platforms: z.array(z.enum(['windows', 'macos', 'linux', 'web', 'android', 'ios'])).min(1).optional(),
    version: z.string().trim().min(1).max(64).optional(),
  }),
} as const

export type MetadataSchemaKey = keyof typeof metadataSchemas
export type CategoryMetadata<K extends MetadataSchemaKey> = z.output<(typeof metadataSchemas)[K]>

/** Select the schema from the persisted category, never from a client-provided category label. */
export function parseCategoryMetadata(schemaKey: string, value: unknown) {
  if (!Object.hasOwn(metadataSchemas, schemaKey)) throw new Error(`Unknown metadata schema: ${schemaKey}`)
  return metadataSchemas[schemaKey as MetadataSchemaKey].parse(value)
}
