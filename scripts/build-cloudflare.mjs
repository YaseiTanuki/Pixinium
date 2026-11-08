// Select the Workers thumbnail implementation before Next.js resolves imports.
process.env.PIXINIUM_CLOUDFLARE_BUILD = '1'
process.env.NODE_ENV = 'production'
process.argv.splice(2, 0, 'build')

await import(new URL('../cli/index.js', import.meta.resolve('@opennextjs/cloudflare')).href)
