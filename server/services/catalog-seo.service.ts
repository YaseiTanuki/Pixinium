import 'server-only'
import { neon } from '@neondatabase/serverless'
import { sitemapItemsQuery } from '../repositories/catalog-seo.queries'

export async function listSitemapItems(): Promise<{ category: string; slug: string; images: string[] }[]> {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to load the sitemap.')
  return await neon(process.env.DATABASE_URL).query(sitemapItemsQuery) as { category: string; slug: string; images: string[] }[]
}
