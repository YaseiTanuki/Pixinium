import { fileURLToPath } from 'node:url'

const cloudflareBuild = process.env.PIXINIUM_CLOUDFLARE_BUILD === '1'
const thumbnailModule = '@/server/services/image-thumbnail'
const cloudflareThumbnail = './server/services/image-thumbnail.cloudflare.ts'

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(cloudflareBuild ? {
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
