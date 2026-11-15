import 'server-only'

import { createDatabase } from '@/lib/database'
import { revalidatePath } from 'next/cache'
import { hasPermission } from '@/lib/auth/permissions'
import { isAgentActor } from '@/lib/agent-identity'
import { authDiagnostic } from '@/lib/auth/errors'
import { deleteContentQuery, lockContentForDeletionQuery, lockContentAssetsQuery, exclusiveContentAssetsQuery } from '@/server/repositories/content-delete'
import { deleteStoredContent } from './storage.service'
import type { ContentActor } from './content-upload.service'
import type { ContentResult } from '@/lib/admin/content'

export async function deleteContentForActor(account: ContentActor | null, input: unknown): Promise<ContentResult> {
  if (!account || isAgentActor(account) || !hasPermission(account.role, 'admin:access')) return { error: 'Admin access is required to delete content.' }
  if (typeof input !== 'string' || !/^[1-9][0-9]{0,18}$/.test(input) || BigInt(input) > BigInt('9223372036854775807')) return { error: 'Choose a valid content item.' }
  const connection = process.env.CATALOG_ADMIN_DATABASE_URL
  if (!connection) return { error: 'Content writing is not configured.' }
  let row
  let storageFailed = false
  try {
    row = await createDatabase(connection).withTransaction(async client => {
      const { rows: [item] } = await client.query(lockContentForDeletionQuery, [account.id, input])
      if (!item) return null
      await client.query(lockContentAssetsQuery, [input])
      const { rows: assets } = await client.query(exclusiveContentAssetsQuery, [input])
      try {
        await deleteStoredContent(assets as Array<{ provider: string; bucket: string | null; object_path: string | null }>)
      } catch (error) {
        storageFailed = true
        console.error('[content.delete-storage]', authDiagnostic(error), { assets })
        throw error
      }
      const { rows: [deleted] } = await client.query(deleteContentQuery, [account.id, input])
      if (!deleted) throw new Error('Content changed during deletion.')
      return item
    })
  } catch (error) {
    if (storageFailed) return { error: 'Stored files could not all be deleted. The item has been kept so you can retry. Some files may already have been removed.' }
    console.error('[content.delete]', authDiagnostic(error))
    return { error: 'Content could not be deleted. Please try again.' }
  }
  if (!row) return { error: 'Content was already deleted or your admin access changed. Refresh the studio.' }
  try {
    for (const path of ['/', '/search', '/admin', '/profile', `/items/${row.category}/${row.slug}`]) revalidatePath(path)
  } catch (error) { console.error('[content.delete-revalidate]', authDiagnostic(error)) }
  return { message: 'Content deleted.' }
}
