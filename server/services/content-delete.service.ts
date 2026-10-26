import 'server-only'

import { neon } from '@neondatabase/serverless'
import { revalidatePath } from 'next/cache'
import { hasPermission } from '@/lib/auth/permissions'
import { authDiagnostic } from '@/lib/auth/errors'
import { deleteContentQuery } from '@/server/repositories/content-delete'
import { deleteStoredContent } from './storage.service'
import type { ContentActor } from './content-upload.service'
import type { ContentResult } from '@/lib/admin/content'

export async function deleteContentForActor(account: ContentActor | null, input: unknown): Promise<ContentResult> {
  if (!account || !hasPermission(account.role, 'admin:access')) return { error: 'Admin access is required to delete content.' }
  if (typeof input !== 'string' || !/^[1-9][0-9]{0,18}$/.test(input) || BigInt(input) > BigInt('9223372036854775807')) return { error: 'Choose a valid content item.' }
  const connection = process.env.CATALOG_ADMIN_DATABASE_URL
  if (!connection) return { error: 'Content writing is not configured.' }
  let row
  try {
    ;[row] = await neon(connection).query(deleteContentQuery, [account.id, input])
  } catch (error) {
    console.error('[content.delete]', authDiagnostic(error))
    return { error: 'Content could not be deleted. Please try again.' }
  }
  if (!row) return { error: 'Content was already deleted or your admin access changed. Refresh the studio.' }
  let message = 'Content deleted.'
  try {
    await deleteStoredContent(row.assets)
  } catch (error) {
    console.error('[content.delete-storage]', authDiagnostic(error), { assets: row.assets })
    message = 'Content deleted from the archive, but some stored files could not be removed. Contact an administrator for cleanup.'
  }
  try {
    for (const path of ['/', '/search', '/admin', '/profile', `/items/${row.category}/${row.slug}`]) revalidatePath(path)
  } catch (error) { console.error('[content.delete-revalidate]', authDiagnostic(error)) }
  return { message }
}
