import type { MetadataRoute } from 'next'
import { robotsConfiguration } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  return robotsConfiguration()
}
