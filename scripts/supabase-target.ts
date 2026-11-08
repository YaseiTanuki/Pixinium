export function supabaseTarget(env: Record<string, string | undefined> = process.env) {
  const ref = env.SUPABASE_PROJECT_REF
  const connection = env.DATABASE_URL_UNPOOLED
  if (!ref || !/^[a-z0-9]{20}$/.test(ref) || !connection || !env.MIGRATION_TARGET_HOST) {
    throw new Error('Set SUPABASE_PROJECT_REF, DATABASE_URL_UNPOOLED and MIGRATION_TARGET_HOST for the confirmed Supabase project.')
  }
  const url = new URL(connection)
  const direct = url.hostname === `db.${ref}.supabase.co`
  const pooled = url.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(url.username) === `postgres.${ref}`
  if ((!direct && !pooled) || url.hostname !== env.MIGRATION_TARGET_HOST || url.pathname !== '/postgres' ||
    (url.port && url.port !== '5432') || (direct && decodeURIComponent(url.username) !== 'postgres')) {
    throw new Error('Use the confirmed Supabase owner direct or Session pooler connection on port 5432.')
  }
  url.searchParams.set('sslmode', 'verify-full')
  return { connectionString: url.href, runtimeUrl(role: string, password: string) {
    const runtime = new URL(url)
    runtime.username = pooled ? `${role}.${ref}` : role
    runtime.password = password
    return runtime.href
  } }
}
