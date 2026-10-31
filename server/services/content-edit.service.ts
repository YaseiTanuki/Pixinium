import 'server-only'

import { randomUUID } from 'node:crypto'
import { neon } from '@neondatabase/serverless'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { hasPermission } from '@/lib/auth/permissions'
import { authDiagnostic } from '@/lib/auth/errors'
import { contentUpdateSchema, type ContentResult } from '@/lib/admin/content'
import { CONTENT_SCHEMAS } from '@/lib/content-types'
import { parseCategoryMetadata } from '@/lib/entities/metadata'
import { itemStorageDirectory } from '@/lib/admin/storage-paths'
import { currentAssetIdsQuery, editableContentQuery, updateContentStatements } from '@/server/repositories/content-edit'
import { validateContentFiles, inspectContentFiles, finalizeContentFiles } from './content-files'
import { requirePrivateStorage, deleteStagingUploads, deleteStoredContent, deleteGeneratedPackFiles } from './storage.service'
import type { ContentActor } from './content-upload.service'

export type EditableContent = {
  id: string; title: string; summary: string; description: string; slug: string; category: string
  schemaKey: string; uses: string[]; tags: string[]; facts: Array<{ key: string; label: string; value: string }>
  files: Array<{ label: string; role: string; mediaType: string }>
}

// Image and asset-pack facts are generated from their files, so they are not hand-edited.
const factsEditable = (schemaKey: string) => schemaKey !== CONTENT_SCHEMAS.image && schemaKey !== CONTENT_SCHEMAS.asset

export async function getEditableContentForActor(account: ContentActor | null, id: string): Promise<EditableContent | null> {
  if (!account || !hasPermission(account.role, 'admin:access') || !/^[1-9][0-9]{0,18}$/.test(id) || BigInt(id) > BigInt('9223372036854775807')) return null
  const connection = process.env.CATALOG_ADMIN_DATABASE_URL
  if (!connection) return null
  const [row] = await neon(connection).query(editableContentQuery, [id])
  if (!row) return null
  return { id: String(row.id), title: String(row.title), summary: String(row.summary), description: String(row.description),
    slug: String(row.slug), category: String(row.category), schemaKey: String(row.metadata_schema_key),
    uses: row.uses as string[], tags: row.tags as string[], facts: row.facts as EditableContent['facts'], files: row.files as EditableContent['files'] }
}

export async function updateContentForActor(account: ContentActor | null, input: unknown): Promise<ContentResult> {
  if (!account || !hasPermission(account.role, 'admin:access')) return { error: 'Admin access is required to edit content.' }
  const parsed = contentUpdateSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the content fields.' }
  const value = parsed.data
  if (BigInt(value.id) > BigInt('9223372036854775807')) return { error: 'Choose a valid content item.' }
  const connection = process.env.CATALOG_ADMIN_DATABASE_URL
  if (!connection) return { error: 'Content writing is not configured.' }
  const sql = neon(connection)
  let pendingFiles: { directory: string; paths: string[] } | undefined
  let committed = false
  try {
    const [current] = await sql.query(editableContentQuery, [value.id])
    if (!current) return { error: 'Content no longer exists. Refresh the studio.' }
    const validUses = await sql.query('SELECT slug FROM catalog.content_uses WHERE slug = ANY($1::text[])', [value.uses])
    if (validUses.length !== value.uses.length) return { error: 'A selected use is no longer available. Reload the page.' }
    const schemaKey = String(current.metadata_schema_key)
    let files: Parameters<typeof updateContentStatements>[0]['files']
    if (value.attachments) {
      const fileError = validateContentFiles(schemaKey, value.attachments)
      if (fileError) return { error: fileError }
      const { bucket } = await requirePrivateStorage()
      const inspected = await inspectContentFiles(account.id, value.attachments)
      if ('error' in inspected) return { error: inspected.error }
      const [existing] = await sql.query(currentAssetIdsQuery, [value.id])
      // Each replacement gets its own folder so generated names (thumbnail, pack.zip) never collide with the old files.
      const directory = `${itemStorageDirectory(String(current.category), value.id)}/v-${randomUUID()}`
      const { finalized, pack, musicMetadata } = await finalizeContentFiles(schemaKey, inspected.attachments, directory)
      pendingFiles = { directory, paths: finalized.map(asset => asset.path) }
      if (pack) pendingFiles.paths.push(...pack.paths)
      const metadata = schemaKey === CONTENT_SCHEMAS.asset
        ? parseCategoryMetadata(schemaKey, { image_count: value.attachments.filter(asset => asset.role === 'download').length })
        : musicMetadata
      files = { oldAssetIds: existing.ids as string[], attachments: finalized, bucket, metadata }
    }
    const results = await sql.transaction(txn => updateContentStatements({
      actor: account.id, id: value.id, editFacts: factsEditable(schemaKey), files,
      text: { title: value.title, summary: value.summary, description: value.description, uses: value.uses, tags: value.tags, facts: value.facts },
    }).map(([text, values]) => txn.query(text, values)))
    const [row] = results[results.length - 1] as Array<Record<string, unknown>>
    if (!row) return { error: 'Content was deleted or your admin access changed. Refresh the studio.' }
    committed = true
    let message = 'Content updated.'
    if (value.attachments) {
      try { await deleteStagingUploads(value.attachments.map(asset => asset.path)) }
      catch (error) { console.error('[content.staging-cleanup]', authDiagnostic(error)) }
      const replaced = results[1] as Array<{ provider: string; bucket: string | null; object_path: string | null }>
      try { await deleteStoredContent(replaced) } catch (error) {
        console.error('[content.replace-storage]', authDiagnostic(error), { assets: replaced })
        message = 'Content updated, but some replaced files could not be removed from storage. Contact an administrator for cleanup.'
      }
    }
    try {
      for (const path of ['/', '/search', '/admin', '/profile', `/items/${row.category}/${row.slug}`]) revalidatePath(path)
    } catch (error) { console.error('[content.edit-revalidate]', authDiagnostic(error)) }
    return { id: String(row.id), slug: String(row.slug), category: String(row.category), message,
      href: `/items/${row.category}/${row.slug}` }
  } catch (error) {
    console.error('[content.edit]', authDiagnostic(error))
    if (error instanceof z.ZodError) return { error: error.issues[0]?.message ?? 'Check the content fields.' }
    return { error: 'Content could not be updated. Your changes are preserved; please try again.' }
  } finally {
    if (pendingFiles && !committed) {
      // A transport failure can hide a successful commit; keep any objects the catalog already references.
      try {
        const linked = await sql.query('SELECT 1 FROM catalog.assets WHERE provider = $1 AND object_path = ANY($2::text[]) LIMIT 1', ['s3', pendingFiles.paths])
        if (!linked.length) await deleteGeneratedPackFiles(pendingFiles.directory, pendingFiles.paths)
      } catch (error) { console.error('[content.replace-cleanup]', authDiagnostic(error)) }
    }
  }
}
