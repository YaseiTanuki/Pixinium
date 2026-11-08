import { getCloudflareContext } from '@opennextjs/cloudflare'

const bindingsByRole = { DATABASE_URL: 'DATABASE_POOL', CATALOG_ADMIN_DATABASE_URL: 'CATALOG_ADMIN_POOL',
  AGENT_DATABASE_URL: 'AGENT_POOL' } as const

/** Preserve role separation when optional Hyperdrive pools are bound in Workers. */
export function connectionForRole(connection: string, urls: Record<string, string | undefined>,
  bindings: Record<string, { connectionString?: string } | undefined>) {
  for (const [variable, binding] of Object.entries(bindingsByRole)) {
    if (urls[variable] === connection && bindings[binding]?.connectionString) return bindings[binding]!.connectionString!
  }
  return connection
}

export function runtimeDatabaseConnection(connection: string) {
  try {
    const env = getCloudflareContext().env as unknown as Record<string, { connectionString?: string } | undefined>
    return connectionForRole(connection, process.env, env)
  } catch { return connection }
}
