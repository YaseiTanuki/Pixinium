import { GetObjectCommand, HeadObjectCommand, type HeadObjectCommandOutput, type S3Client } from '@aws-sdk/client-s3'

/** HEAD has no error body. An authenticated one-byte GET also exposes S3 error codes. */
export async function inspectStorageObject(storage: S3Client, bucket: string, key: string): Promise<HeadObjectCommandOutput> {
  try {
    return await storage.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
  } catch (error) {
    if (!error || typeof error !== 'object' || !('$metadata' in error) ||
      (error.$metadata as { httpStatusCode?: number } | undefined)?.httpStatusCode !== 403) throw error
  }
  const result = await storage.send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: 'bytes=0-0' }))
  const { Body, ...metadata } = result
  if (!Body) throw new Error('Storage inspection returned no body')
  const reader = Body.transformToWebStream().getReader()
  try {
    const match = /^bytes 0-0\/([1-9]\d*)$/.exec(result.ContentRange ?? '')
    const size = match ? Number(match[1]) : NaN
    if (result.$metadata.httpStatusCode !== 206 || result.ContentLength !== 1 || !Number.isSafeInteger(size)) {
      throw new Error('Storage inspection returned an invalid byte range')
    }
    const first = await reader.read()
    if (first.done || first.value.byteLength !== 1 || !(await reader.read()).done) {
      throw new Error('Storage inspection returned an invalid body')
    }
    return { ...metadata, ContentLength: size }
  } finally {
    await reader.cancel()
  }
}
