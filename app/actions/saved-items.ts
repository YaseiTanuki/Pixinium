'use server'

import { neon } from '@neondatabase/serverless'
import { z } from 'zod'
import { getAccount } from '@/server/services/auth.service'
import { authDiagnostic } from '@/lib/auth/errors'
import { collectItemQuery, ensureSavedCollectionQuery, savedItemsQuery, uncollectItemQuery } from '@/server/repositories/saved-items'

const inputSchema = z.object({
  id: z.string().regex(/^[1-9][0-9]{0,18}$/).refine(id => id.length < 19 || id <= '9223372036854775807'),
  saved: z.boolean(),
})

export async function loadSavedItems() {
  try {
    const account = await getAccount()
    if (!account) return { ids: [] as string[], loginRequired: true }
    const sql = neon(process.env.DATABASE_URL!)
    const results = await sql.transaction([
      sql`SELECT set_config('app.user_id', ${account.id}, true)`,
      sql.query(savedItemsQuery, [account.id]),
    ])
    return { ids: results[1].map(row => String(row.id)) }
  } catch (error) {
    console.error('[collection.load]', authDiagnostic(error))
    return { error: 'Could not load your collection. Please try again.' }
  }
}

export async function setItemCollected(input: unknown) {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid collection item.' }
  try {
    const account = await getAccount()
    if (!account) return { loginRequired: true }
    const sql = neon(process.env.DATABASE_URL!)
    const { id, saved } = parsed.data
    const results = await sql.transaction([
      sql`SELECT set_config('app.user_id', ${account.id}, true)`,
      // Serialize changes for this account, including requests from other tabs.
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${'saved:' + account.id}, 0))`,
      ...(saved ? [sql.query(ensureSavedCollectionQuery, [account.id])] : []),
      sql.query(saved ? collectItemQuery : uncollectItemQuery, [account.id, id]),
      sql.query(savedItemsQuery, [account.id]),
    ])
    const ids = results.at(-1)!.map(row => String(row.id))
    if (saved && !ids.includes(id)) return { ids, error: 'This item is no longer available to collect.' }
    return { ids }
  } catch (error) {
    console.error('[collection.save]', authDiagnostic(error))
    return { error: 'Could not update your collection. Please try again.' }
  }
}
