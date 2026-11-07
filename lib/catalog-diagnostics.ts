const transportCodes = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET',
  'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'])

/** Log categories only: provider messages can contain credentials, SQL and user data. */
export function catalogDiagnostic(error: unknown, connection: string | undefined) {
  const value = error && typeof error === 'object' ? error as Record<string, unknown> : {}
  const cause = value.cause && typeof value.cause === 'object' ? value.cause as Record<string, unknown> : {}
  const rawCode = typeof value.code === 'string' ? value.code : ''
  const code = /^[0-9A-Z]{5}$/.test(rawCode) || transportCodes.has(rawCode) ? rawCode : 'unknown'
  const transport = typeof cause.code === 'string' && transportCodes.has(cause.code) ? cause.code : undefined
  const message = typeof value.message === 'string' ? value.message : ''
  let configuration: 'missing' | 'invalid' | 'present' = 'missing'
  if (connection) {
    try {
      const url = new URL(connection)
      configuration = ['postgres:', 'postgresql:'].includes(url.protocol) && url.hostname && url.username && url.pathname.length > 1
        ? 'present' : 'invalid'
    } catch { configuration = 'invalid' }
  }
  const category = configuration !== 'present' ? 'configuration'
    : code === '28P01' || code === '28000' ? 'authentication'
    : code === '42501' ? 'permission'
    : ['42P01', '42703', '3F000', '3D000'].includes(code) ? 'schema'
    : code === '53300' ? 'connection_limit'
    : code === '57014' || /timeout|timed out/i.test(message) ? 'timeout'
    : transport || transportCodes.has(code) || /fetch failed|network|connecting to database/i.test(message) ? 'network'
    : 'database_or_render'
  return { configuration, code, category, ...(transport ? { transport } : {}) }
}

export async function withCatalogDiagnostics<T>(operation: 'home' | 'catalog_api', read: () => Promise<T>): Promise<T> {
  try { return await read() }
  catch (error) {
    // A JSON string survives log pipelines that otherwise serialize only Error.stack.
    console.error(JSON.stringify({ event: 'catalog.read.failed', operation,
      ...catalogDiagnostic(error, process.env.DATABASE_URL) }))
    throw error
  }
}
