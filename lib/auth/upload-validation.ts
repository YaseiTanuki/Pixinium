export const MAX_UPLOAD_BYTES = 750 * 1024

// Browser filenames and MIME types are untrusted. Only recognize raster signatures.
export function imageFormat(bytes: Uint8Array): { extension: string; mime: string } | null {
  if (bytes.length < 12) return null
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) {
    return { extension: 'png', mime: 'image/png' }
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extension: 'jpg', mime: 'image/jpeg' }
  }
  if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') {
    return { extension: 'webp', mime: 'image/webp' }
  }
  return null
}
