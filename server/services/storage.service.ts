import { MAX_CONTENT_FILE_BYTES } from '../../lib/admin/limits'
import 'server-only'
import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, CopyObjectCommand, DeleteObjectCommand, GetBucketAclCommand, GetBucketPolicyCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createImageThumbnail } from './image-thumbnail'

export function storageConfigured() {
  return Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_ENDPOINT_URL_S3 && process.env.AWS_REGION)
}

export function adminStorage() {
  if (!storageConfigured()) throw new Error('Object storage is not configured.')
  if (new URL(process.env.AWS_ENDPOINT_URL_S3!).protocol !== 'https:') throw new Error('Storage requires HTTPS.')
  return { bucket: process.env.S3_ASSETS_BUCKET || 'assets', storage: new S3Client({ forcePathStyle: true }) }
}

export async function requirePrivateStorage() {
  const { storage, bucket } = adminStorage()
  const acl = await storage.send(new GetBucketAclCommand({ Bucket: bucket }))
  if (acl.Grants?.some(grant => grant.Grantee?.Type === 'Group' && /AllUsers|AuthenticatedUsers/.test(grant.Grantee.URI ?? ''))) {
    throw new Error('The assets bucket must be private.')
  }
  try {
    const result = await storage.send(new GetBucketPolicyCommand({ Bucket: bucket }))
    const policy = JSON.parse(result.Policy || '{}')
    const statements = Array.isArray(policy.Statement) ? policy.Statement : policy.Statement ? [policy.Statement] : []
    if (statements.some((statement: { Effect?: string; Principal?: unknown }) =>
      statement.Effect === 'Allow' && JSON.stringify(statement.Principal ?? '').includes('*'))) {
      throw new Error('The assets bucket must be private.')
    }
  } catch (error) {
    if (!(error instanceof Error && error.name === 'NoSuchBucketPolicy')) throw error
  }
  return { storage, bucket }
}

export async function signUpload(path: string, mime: string, size: number) {
  const { storage, bucket } = await requirePrivateStorage()
  const url = await getSignedUrl(storage, new PutObjectCommand({
    Bucket: bucket, Key: `staging/${path}`, ContentType: mime, ContentLength: size,
  }), { expiresIn: 300, signableHeaders: new Set(['content-type', 'content-length']) })
  return { bucket, url }
}

export async function inspectUpload(path: string) {
  const { storage, bucket } = adminStorage()
  return storage.send(new HeadObjectCommand({ Bucket: bucket, Key: `staging/${path}` }))
}

/** Only accepts validated user-owned relative paths; never deletes content keys. */
export async function deleteStagingUploads(paths: string[]) {
  const { storage, bucket } = adminStorage()
  await Promise.all(paths.map(path => storage.send(new DeleteObjectCommand({ Bucket: bucket, Key: `staging/${path}` }))))
}

/** Accept only asset records returned by the authorized database deletion. */
export async function deleteStoredContent(assets: Array<{ provider: string; bucket: string | null; object_path: string | null }>) {
  const stored = assets.filter(asset => asset.provider === 's3')
  if (!stored.length) return
  const { storage, bucket } = adminStorage()
  const results = await Promise.allSettled(stored.map(async asset => {
    if (asset.bucket !== bucket || !asset.object_path) throw new Error('Unexpected content storage location.')
    await storage.send(new DeleteObjectCommand({ Bucket: bucket, Key: asset.object_path }))
  }))
  if (results.some(result => result.status === 'rejected')) throw new Error('Some content files could not be deleted.')
}

export async function cleanupExpiredStaging(userId: string) {
  const { storage, bucket } = adminStorage()
  const prefix = `staging/${userId}/`
  const cutoff = Date.now() - 24 * 60 * 60 * 1000
  const result = await storage.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, MaxKeys: 1000 }))
  const expired = (result.Contents ?? []).filter(object => object.Key?.startsWith(prefix) && object.LastModified && object.LastModified.getTime() < cutoff)
  for (const object of expired) await storage.send(new DeleteObjectCommand({ Bucket: bucket, Key: object.Key! }))
}

export async function finalizeUpload(path: string, etag: string, mime: string, size: number, directory: string) {
  const { storage, bucket } = adminStorage()
  const destination = `${directory}/originals/${randomUUID()}.${path.split('.').pop()}`
  await storage.send(new CopyObjectCommand({ Bucket: bucket, Key: destination,
    CopySource: `${bucket}/staging/${path}`.split('/').map(encodeURIComponent).join('/'),
    CopySourceIfMatch: etag,
    MetadataDirective: 'REPLACE', ContentType: mime,
  }))
  const copied = await storage.send(new HeadObjectCommand({ Bucket: bucket, Key: destination }))
  if (copied.ETag !== etag || copied.ContentLength !== size || copied.ContentType !== mime) {
    await storage.send(new DeleteObjectCommand({ Bucket: bucket, Key: destination }))
    throw new Error('Upload changed during finalization; upload it again.')
  }
  return destination
}

export async function signDownload(path: string, download: boolean, filename?: string) {
  const { storage, bucket } = adminStorage()
  return getSignedUrl(storage, new GetObjectCommand({ Bucket: bucket, Key: path,
    ResponseContentDisposition: download
      ? filename ? `attachment; filename="${filename.replace(/[^a-zA-Z0-9_.-]/g, '_')}"` : 'attachment'
      : 'inline',
  }), { expiresIn: 60 })
}

/** Fetch audio per request so seeking never depends on an expired signed URL. */
export async function readAudioStream(path: string, range?: string) {
  const { storage, bucket } = adminStorage()
  return storage.send(new GetObjectCommand({ Bucket: bucket, Key: path, Range: range }))
}

export async function readStoredBytes(path: string, size: number, etag?: string) {
  const { storage, bucket } = adminStorage()
  const original = await storage.send(new GetObjectCommand({ Bucket: bucket, Key: path, IfMatch: etag }))
  if (!original.Body || original.ContentLength !== size || size > MAX_CONTENT_FILE_BYTES) throw new Error('Invalid original image')
  const bytes = await original.Body.transformToByteArray()
  if (bytes.byteLength !== size) throw new Error('Incomplete original image')
  return bytes
}

export async function storeImageThumbnail(originalPath: string, size: number, directory: string, etag?: string) {
  const { storage, bucket } = adminStorage()
  const bytes = await readStoredBytes(originalPath, size, etag)
  const thumbnail = await createImageThumbnail(bytes)
  const path = `${directory}/thumbnail.webp`
  await storage.send(new PutObjectCommand({ Bucket: bucket, Key: path,
    Body: thumbnail.data, ContentType: 'image/webp', ContentLength: thumbnail.data.length }))
  return { path, mime: 'image/webp', mediaType: 'image' as const, byteSize: thumbnail.data.length,
    width: thumbnail.width, height: thumbnail.height,
    originalWidth: thumbnail.originalWidth, originalHeight: thumbnail.originalHeight, originalMime: thumbnail.originalMime }
}

export async function storeGeneratedImage(path: string, bytes: Uint8Array) {
  const { storage, bucket } = adminStorage()
  await storage.send(new PutObjectCommand({ Bucket: bucket, Key: path,
    Body: bytes, ContentLength: bytes.length, ContentType: 'image/webp' }))
}

export async function storeGeneratedZip(path: string, localFile: string, size: number) {
  const { storage, bucket } = adminStorage()
  const body = createReadStream(localFile)
  try {
    await storage.send(new PutObjectCommand({ Bucket: bucket, Key: path,
      Body: body, ContentLength: size, ContentType: 'application/zip',
      ContentDisposition: 'attachment; filename="asset-pack.zip"' }))
  } finally { body.destroy() }
}

/** Only server-generated paths in the newly reserved item directory are accepted. */
export async function deleteGeneratedPackFiles(directory: string, paths: string[]) {
  if (paths.some(path => !path.startsWith(`${directory}/`) || path.includes('..'))) {
    throw new Error('Unexpected generated file path')
  }
  const { storage, bucket } = adminStorage()
  await Promise.all(paths.map(path => storage.send(new DeleteObjectCommand({ Bucket: bucket, Key: path }))))
}
