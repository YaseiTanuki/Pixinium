import { createContentQuery } from '../repositories/content-write'
import { createItemSlug } from './item-slug'

type Query = (sql: string, values: unknown[]) => Promise<Record<string, unknown>[]>

/** Retry only the category/slug unique conflict. Each failed write rolls back all its relationships. */
export async function createContentWithTitleSlug(query: Query, actor: string, categoryId: string,
  schemaKey: string, content: { title: string; [key: string]: unknown }, bucket: string) {
  return withContentSlug(content.title,
    base => query(`SELECT slug FROM catalog.items WHERE category_id = $1::bigint AND (slug = $2 OR slug LIKE $3)`, [categoryId, base, `${base}-%`]),
    slug => query(createContentQuery, [actor, categoryId, schemaKey, JSON.stringify({ ...content, slug }), bucket]))
}

export async function withContentSlug(title: string, listSlugs: (base: string) => Promise<Record<string, unknown>[]>,
  create: (slug: string) => Promise<Record<string, unknown>[]>) {
  const base = createItemSlug(title)
  for (let attempt = 0; attempt < 8; attempt++) {
    const existing = await listSlugs(base)
    const used = new Set(existing.map(row => String(row.slug)))
    let slug = base
    for (let suffix = 1; used.has(slug); suffix++) slug = `${base}-${suffix}`
    try {
      return await create(slug)
    } catch (error) {
      const failure = error as { code?: string; constraint?: string }
      if (failure.code !== '23505' || failure.constraint !== 'items_category_slug_key' || attempt === 7) throw error
    }
  }
  throw new Error('Unable to allocate an item URL')
}
