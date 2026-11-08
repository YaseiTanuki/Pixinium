import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { r2Config, requirePrivateR2 } from '../lib/r2-config.ts'

const config = r2Config()
requirePrivateR2(config)
const storage = new S3Client(config.client)
const Bucket = config.bucket
const cutoff = Date.now() - 24 * 60 * 60 * 1000
let removed = 0
let retained = 0
try {
  let ContinuationToken
  do {
    const page = await storage.send(new ListObjectsV2Command({ Bucket, Prefix: 'staging/', ContinuationToken }))
    for (const object of page.Contents ?? []) {
      if (object.Key?.startsWith('staging/') && object.LastModified?.getTime() < cutoff) {
        await storage.send(new DeleteObjectCommand({ Bucket, Key: object.Key }))
        removed++
      } else retained++
    }
    ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined
  } while (ContinuationToken)
  console.log(`Removed ${removed} staging objects older than 24 hours; retained ${retained} recent uploads. Published content untouched.`)
} catch { console.error('Staging cleanup failed; retry later.'); process.exitCode = 1 }
finally { storage.destroy() }
