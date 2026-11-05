'use server'

import { getAccount } from '@/server/services/auth.service'
import { manageDownloadProviderForActor } from '@/server/services/download-sources.service'

export async function saveDownloadProvider(operation: 'create' | 'update', input: unknown) {
  return manageDownloadProviderForActor(await getAccount(), operation, input)
}
export async function deleteDownloadProvider(slug: string) {
  return manageDownloadProviderForActor(await getAccount(), 'delete', slug)
}
