import sharp from 'sharp'

/** Decode only supported raster images; never modify the original bytes. */
export async function createImageThumbnail(original: Uint8Array) {
  const options = { limitInputPixels: 64_000_000, failOn: 'error' as const }
  const metadata = await sharp(original, options).metadata()
  if (!['jpeg', 'png', 'webp', 'avif', 'heif'].includes(metadata.format ?? '')) {
    throw new Error('Unsupported image format')
  }
  const { data, info } = await sharp(original, options).rotate()
    .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 }).timeout({ seconds: 15 }).toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height,
    originalWidth: metadata.autoOrient.width, originalHeight: metadata.autoOrient.height,
    originalMime: `image/${metadata.format === 'heif' && metadata.compression === 'av1' ? 'avif' : metadata.format}` }
}
