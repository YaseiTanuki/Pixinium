import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash')
  const type = request.nextUrl.searchParams.get('type')
  let success = false
  if (tokenHash && tokenHash.length <= 2048 && type === 'email') {
    try {
      const client = await createClient()
      const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: 'email' })
      success = !error
    } catch { /* Return a fixed local destination, without exposing provider details. */ }
  }
  const response = NextResponse.redirect(new URL(success ? '/profile' : '/auth/confirmation-error', request.url))
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}
