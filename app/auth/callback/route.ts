import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { authDiagnostic } from '@/lib/auth/errors'

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const code = params.get('code')
  let success = false
  if (!params.has('error') && code && code.length <= 2048) {
    try {
      const client = await createClient()
      const { error } = await client.auth.exchangeCodeForSession(code)
      success = !error
      if (error) console.error('[auth.google.callback]', authDiagnostic(error))
    } catch (error) {
      console.error('[auth.google.callback]', authDiagnostic(error))
    }
  }
  // Fixed local destinations prevent user-controlled redirect targets.
  const response = NextResponse.redirect(new URL(success ? '/choose-username' : '/login?error=google', request.url))
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}
