import { r2Config } from '../lib/r2-config'

async function main() {
  const config = r2Config()
  const token = process.env.CLOUDFLARE_API_TOKEN
  if (!token) throw new Error('A local Cloudflare API token with R2 read permissions is required for the automated public-access check.')
  const account = new URL(config.client.endpoint).hostname.split('.')[0]
  const base = `https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets/${config.bucket}/domains`
  const read = async (suffix: string) => {
    const response = await fetch(`${base}/${suffix}`, { headers: { Authorization: `Bearer ${token}` }, redirect: 'error' })
    if (!response.ok) throw new Error(`Cloudflare configuration check failed with HTTP ${response.status}.`)
    const payload = await response.json() as { success?: boolean; result?: unknown }
    if (payload.success !== true || !payload.result) throw new Error('Cloudflare configuration response was incomplete.')
    return payload.result
  }
  const managed = await read('managed') as { enabled?: boolean }
  const custom = await read('custom') as { domains?: { enabled?: boolean }[] }
  if (managed.enabled !== false || !Array.isArray(custom.domains) || custom.domains.some(domain => domain.enabled !== false)) {
    throw new Error('R2 public access is enabled or could not be verified. Disable r2.dev and enabled public custom domains.')
  }
  console.log(`R2 bucket ${config.bucket} has public access disabled. R2_BUCKET_PRIVATE may be set to true for this verified deployment.`)
}
main().catch(error => { console.error('R2 privacy verification failed:', error instanceof Error ? error.message : 'Unknown error'); process.exitCode = 1 })
