import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { authDiagnostic } from '@/lib/auth/errors'

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const code = params.get('code')
  const tokenHash = params.get('token_hash')
  let success = false
  try {
    if (!params.has('error')) {
      const client = await createClient()
      if (tokenHash && tokenHash.length <= 2048 && params.get('type') === 'recovery') {
        const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
        success = !error
        if (error) console.error('[auth.password.recovery.otp]', authDiagnostic(error))
      } else if (code && code.length <= 2048) {
        const { error } = await client.auth.exchangeCodeForSession(code)
        success = !error
        if (error) console.error('[auth.password.recovery.pkce]', authDiagnostic(error))
      }
    }
  } catch (error) {
    console.error('[auth.password.recovery]', authDiagnostic(error))
  }
  const response = NextResponse.redirect(new URL(success ? '/reset-password' : '/forgot-password?error=expired', request.url))
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}
