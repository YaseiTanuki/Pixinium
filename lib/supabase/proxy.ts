import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseConfig } from './config'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const { url, publishableKey } = getSupabaseConfig()
  const cacheHeaders = new Headers()

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        const previousCookies = response.cookies.getAll()
        response = NextResponse.next({ request })
        previousCookies.forEach((cookie) => response.cookies.set(cookie))
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
        Object.entries(headers).forEach(([name, value]) => cacheHeaders.set(name, value))
        cacheHeaders.forEach((value, name) => response.headers.set(name, value))
      },
    },
  })

  // Validate/refresh tokens. Authorization belongs in each protected server operation.
  await supabase.auth.getClaims()
  return response
}
