import { createHash, timingSafeEqual } from 'node:crypto'

export function verifyAgentToken(header: string | null, expectedHash: string) {
  if (!/^[a-f0-9]{64}$/i.test(expectedHash)) return false
  const match = header?.match(/^Bearer ([A-Za-z0-9_-]{32,256})$/)
  if (!match || match[0].length !== header?.length) return false
  return timingSafeEqual(createHash('sha256').update(match[1]).digest(), Buffer.from(expectedHash, 'hex'))
}
