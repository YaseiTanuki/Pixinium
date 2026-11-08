import 'server-only'
import { cache } from 'react'
import { createDatabase } from '@/lib/database'
import { revalidatePath } from 'next/cache'
import { hasPermission } from '@/lib/auth/permissions'
import { providerInputSchema, sourceSlugSchema, type DownloadProvider, type ManagedDownloadProvider } from '@/lib/download-sources'
import { downloadProvidersQuery, managedDownloadProvidersQuery, createDownloadProviderQuery, updateDownloadProviderQuery, deleteDownloadProviderQuery } from '@/server/repositories/download-sources'

export const listDownloadProviders = cache(async (): Promise<DownloadProvider[]> => {
  if (!process.env.DATABASE_URL) throw new Error('Catalog reading is not configured.')
  return await createDatabase(process.env.DATABASE_URL).query(downloadProvidersQuery) as DownloadProvider[]
})
export async function listManagedDownloadProviders(): Promise<ManagedDownloadProvider[]> {
  if (!process.env.CATALOG_ADMIN_DATABASE_URL) throw new Error('Catalog writing is not configured.')
  return await createDatabase(process.env.CATALOG_ADMIN_DATABASE_URL).query(managedDownloadProvidersQuery) as ManagedDownloadProvider[]
}

export async function manageDownloadProviderForActor(actor: { id: string; role: string } | null, operation: 'create' | 'update' | 'delete', input: unknown) {
  if (!actor || !hasPermission(actor.role, 'admin:access')) return { error: 'Admin access is required.' }
  if (!['create', 'update', 'delete'].includes(operation)) return { error: 'Choose a valid source action.' }
  const parsed = operation === 'delete' ? sourceSlugSchema.safeParse(input) : providerInputSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the source fields.' }
  if (!process.env.CATALOG_ADMIN_DATABASE_URL) return { error: 'Catalog writing is not configured.' }
  try {
    const provider = typeof parsed.data === 'string' ? null : parsed.data
    const slug = provider?.slug ?? parsed.data as string
    const values = provider ? [actor.id, provider.slug, provider.name, provider.hostname, provider.priority, provider.isActive] : [actor.id, slug]
    const query = operation === 'create' ? createDownloadProviderQuery : operation === 'update' ? updateDownloadProviderQuery : deleteDownloadProviderQuery
    const rows = await createDatabase(process.env.CATALOG_ADMIN_DATABASE_URL).query(query, values)
    if (!rows.length) return { error: 'Source unavailable or admin access changed. Refresh and retry.' }
    revalidatePath('/admin')
    revalidatePath('/admin/download-sources')
    revalidatePath('/items/[category]/[slug]', 'page')
    return { message: operation === 'delete' ? 'Source deleted.' : 'Source saved.' }
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : ''
    if (code === '23505') return { error: 'That source ID already exists.' }
    if (code === '23503') return { error: 'Items still use this source. Disable it or remove their links before deleting it.' }
    if (code === '23514') return { error: 'Check the source fields. Pixinium cannot be deleted, and a domain cannot change while items use it.' }
    return { error: 'Could not save the source. Your entries are preserved; please retry.' }
  }
}
