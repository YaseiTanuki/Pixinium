import { fileURLToPath } from 'node:url'
import { generateSiteAssets } from './scripts/generate-site-assets.mjs'

generateSiteAssets()

const cloudflareBuild = process.env.PIXINIUM_CLOUDFLARE_BUILD === '1'
const thumbnailModule = '@/server/services/image-thumbnail'
const cloudflareThumbnail = './server/services/image-thumbnail.cloudflare.ts'

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(cloudflareBuild ? {
    // Let OpenNext resolve conditional exports and dynamic parser dependencies.
    serverExternalPackages: ['music-metadata'],
    turbopack: { resolveAlias: { [thumbnailModule]: cloudflareThumbnail } },
    webpack(config) {
      config.resolve.alias[thumbnailModule] = fileURLToPath(new URL(cloudflareThumbnail, import.meta.url))
      return config
    },
  } : {}),
  experimental: {
    agentUpgrade: 'security',
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
