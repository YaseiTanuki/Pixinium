'use server'

import { randomUUID } from 'node:crypto'
import { neon } from '@neondatabase/serverless'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getAccount } from '@/server/services/auth.service'
import { hasPermission } from '@/lib/auth/permissions'
import { contentSchema, fileType, MAX_CONTENT_FILE_BYTES, type ContentResult } from '@/lib/admin/content'
import { parseCategoryMetadata } from '@/lib/entities/metadata'
import { adminStorage } from '@/server/services/storage.service'
import { createContentQuery } from '@/server/repositories/content-write'
import { authDiagnostic } from '@/lib/auth/errors'

export async function prepareContentUpload(input: unknown) {
  try {
    const account = await getAccount()
    if (!account || !hasPermission(account.role, 'assets:upload')) return { error: 'Upload access is required.' }
    const { name, size } = z.object({ name: z.string().max(255), size: z.number().int().positive().max(MAX_CONTENT_FILE_BYTES) }).parse(input)
    const type = fileType(name)
    if (!type) return { error: 'Choose an image, audio, video, PDF or ZIP file from the supported formats.' }
    const { storage, bucket } = adminStorage()
    const { data: config, error: bucketError } = await storage.getBucket(bucket)
    if (bucketError || !config || config.public) return { error: 'Configure a private upload bucket first.' }
    if (config.file_size_limit && size > Number(config.file_size_limit)) return { error: 'This file exceeds the storage bucket limit.' }
    const path = `${account.id}/${randomUUID()}.${type.extension}`
    const { data, error } = await storage.from(bucket).createSignedUploadUrl(path, { upsert: false })
    if (error || !data) return { error: 'Could not prepare the upload. Try again.' }
    return { bucket, path, token: data.token, mime: type.mime }
  } catch (error) {
    console.error('[content.upload]', authDiagnostic(error))
    return { error: error instanceof z.ZodError ? 'Choose a file up to 50 MB.' : 'Upload storage is unavailable.' }
  }
}

export async function createContent(input: unknown): Promise<ContentResult> {
  try {
    const account = await getAccount()
    if (!account || !hasPermission(account.role, 'assets:upload')) return { error: 'You do not have access to create content.' }
    const parsed = contentSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the content fields.' }
    const value = parsed.data
    const connection = process.env.CATALOG_ADMIN_DATABASE_URL
    if (!connection) return { error: 'Content writing is not configured. Set the server-side catalog admin connection.' }
    const sql = neon(connection)
    const categories = await sql`SELECT metadata_schema_key FROM catalog.categories WHERE id = ${value.categoryId}::bigint AND is_active`
    if (!categories[0]) return { error: 'Choose an active category.' }
    const validUses = await sql.query('SELECT slug FROM catalog.content_uses WHERE slug = ANY($1::text[])', [value.uses])
    if (validUses.length !== value.uses.length) return { error: 'A selected use is no longer available. Reload the studio.' }
    const schemaKey = String(categories[0].metadata_schema_key)
    const metadata = parseCategoryMetadata(schemaKey, value.metadata)
    const { storage, bucket } = adminStorage()
    const { data: bucketConfig, error: bucketError } = await storage.getBucket(bucket)
    if (bucketError || !bucketConfig || bucketConfig.public) return { error: 'The upload bucket must remain private.' }
    const attachments = []
    for (const asset of value.attachments) {
      if (!asset.path.startsWith(`${account.id}/`)) return { error: 'Upload each attachment from your account.' }
      const type = fileType(asset.path)!
      const { data, error } = await storage.from(bucket).info(asset.path)
      if (error || !data || !data.size || data.size > MAX_CONTENT_FILE_BYTES || data.contentType !== type.mime) {
        return { error: 'An attachment is missing, oversized or has an unexpected file type. Upload it again.' }
      }
      attachments.push({ ...asset, ...type, byteSize: data.size })
    }
    const rows = await sql.query(createContentQuery, [account.id, value.categoryId, schemaKey,
      JSON.stringify({ ...value, metadata, attachments }), bucket])
    if (!rows[0]) return { error: 'Your permissions or category changed. Reload the studio and try again.' }
    revalidatePath('/')
    revalidatePath('/search')
    revalidatePath('/admin')
    return { message: value.status === 'published' ? 'Content published to the archive.' : 'Draft saved.',
      href: value.status === 'published' ? `/items/${rows[0].category}/${rows[0].slug}` : undefined }
  } catch (error) {
    console.error('[content.create]', authDiagnostic(error))
    if (error instanceof z.ZodError) return { error: error.issues[0]?.message ?? 'Check category details.' }
    if (authDiagnostic(error).code === '23505') return { error: 'This slug or attachment is already used. Choose a new slug or upload a fresh file.' }
    return { error: 'Content could not be saved. Your form is preserved; check server configuration and try again.' }
  }
}
