import { CONTENT_SCHEMAS } from '../content-types'
import { z } from 'zod'

const positiveInteger = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const nonnegativeInteger = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)

export const metadataSchemas = {
  'generic.v1': z.strictObject({}),
  [CONTENT_SCHEMAS.asset]: z.strictObject({
    image_count: positiveInteger,
  }),
  // Image dimensions/formats live on assets; display facts are derived from them.
  [CONTENT_SCHEMAS.image]: z.strictObject({}),
  [CONTENT_SCHEMAS.music]: z.strictObject({
    track_count: positiveInteger.optional(),
    duration_seconds: nonnegativeInteger.optional(),
    formats: z.array(z.enum(['mp3', 'flac', 'wav', 'ogg', 'aac'])).min(1).optional(),
  }),
  // Game size lives on the download asset; platforms/version use display facts.
  [CONTENT_SCHEMAS.game]: z.strictObject({}),
} as const

export type MetadataSchemaKey = keyof typeof metadataSchemas
export type CategoryMetadata<K extends MetadataSchemaKey> = z.output<(typeof metadataSchemas)[K]>

/** Select the schema from the persisted category, never from a client-provided category label. */
export function parseCategoryMetadata(schemaKey: string, value: unknown) {
  if (!Object.hasOwn(metadataSchemas, schemaKey)) throw new Error(`Unknown metadata schema: ${schemaKey}`)
  return metadataSchemas[schemaKey as MetadataSchemaKey].parse(value)
}
