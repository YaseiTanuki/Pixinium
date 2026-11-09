// OpenNext initializes a local platform proxy to populate its remote R2 cache.
// That proxy validates every Hyperdrive binding, but deployment never queries
// Postgres through it. Production still uses the configured Hyperdrive IDs.
for (const binding of ['DATABASE_POOL', 'CATALOG_ADMIN_POOL', 'AGENT_POOL']) {
  process.env[`CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_${binding}`] ??=
    'postgresql://unused:unused@127.0.0.1:5432/postgres'
}

process.argv.splice(2, 0, 'deploy')
await import(new URL('../cli/index.js', import.meta.resolve('@opennextjs/cloudflare')).href)
