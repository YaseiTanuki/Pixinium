import { z } from 'zod'
import { MAX_ATTACHMENT_COUNT } from './limits'

export function ownedStagingPaths(input: unknown, userId: string): string[] {
  const paths = z.array(z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]+$/)).max(MAX_ATTACHMENT_COUNT).parse(input)
  if (paths.some(path => !path.startsWith(`${userId}/`))) throw new Error('Invalid upload owner')
  return [...new Set(paths)]
}
