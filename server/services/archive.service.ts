import 'server-only'

import type { ArchiveItem } from '../../lib/archive'
import { findArchiveItems } from '../repositories/archive.repository'

export type ArchiveFilters = {
  category?: ArchiveItem['category']
  query?: string
}

export async function listArchiveItems(filters: ArchiveFilters = {}): Promise<ArchiveItem[]> {
  const query = filters.query?.trim()
  return findArchiveItems({
    category: filters.category,
    query: query || undefined,
  })
}
