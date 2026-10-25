import 'server-only'
import { createClient } from '@supabase/supabase-js'

export function adminStorage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const bucket = process.env.SUPABASE_ADMIN_UPLOAD_BUCKET
  if (!url || !key || !bucket) throw new Error('Upload storage is not configured.')
  return { bucket, storage: createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage }
}
