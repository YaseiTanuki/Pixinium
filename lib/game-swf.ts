export const SWF_MIME = 'application/x-shockwave-flash'

export function validateSwf(bytes: Uint8Array) {
  const signature = String.fromCharCode(...bytes.slice(0, 3))
  if (bytes.length < 8 || !['FWS', 'CWS', 'ZWS'].includes(signature)) throw new Error('Upload a valid SWF game file.')
}
