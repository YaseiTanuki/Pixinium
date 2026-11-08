import { readFile, writeFile } from 'node:fs/promises'

export function preserveNoStore(source) {
  const marker = 'delete init2.cache;'
  const parts = source.split(marker)
  if (parts.length !== 3) throw new Error('Unexpected OpenNext initialization: cannot safely preserve no-store')
  return parts.join("if (init2.cache !== 'no-store') delete init2.cache;")
}

export async function patchCloudflareFetchCache(path = '.open-next/cloudflare/init.js') {
  const source = await readFile(path, 'utf8')
  await writeFile(path, preserveNoStore(source))
}
