export function r2Config(env: Record<string, string | undefined> = process.env) {
  const endpoint = env.R2_ENDPOINT_URL
  const bucket = env.R2_BUCKET_NAME
  const accessKeyId = env.R2_ACCESS_KEY_ID
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) throw new Error('Cloudflare R2 is not configured.')
  const url = new URL(endpoint)
  if (url.protocol !== 'https:' || !/^[a-f0-9]{32}(?:\.(?:eu|fedramp))?\.r2\.cloudflarestorage\.com$/.test(url.hostname) ||
    url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new Error('Use the HTTPS R2 account endpoint without the bucket path.')
  }
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) throw new Error('Invalid R2 bucket name.')
  return { bucket, privateConfirmed: env.R2_BUCKET_PRIVATE === 'true', client: {
    endpoint: url.origin, region: 'auto', forcePathStyle: true, credentials: { accessKeyId, secretAccessKey },
    requestChecksumCalculation: 'WHEN_REQUIRED' as const, responseChecksumValidation: 'WHEN_REQUIRED' as const,
  } }
}

export function requirePrivateR2(config: ReturnType<typeof r2Config>) {
  if (!config.privateConfirmed) throw new Error('Confirm R2 public development URL and public custom domains are disabled before enabling uploads.')
}
