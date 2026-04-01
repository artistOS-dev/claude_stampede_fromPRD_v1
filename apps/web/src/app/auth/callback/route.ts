import { NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // Determine the base URL — on Vercel, x-forwarded-host is the real hostname
  const forwardedHost = request.headers.get('x-forwarded-host')
  const redirectBase = forwardedHost ? `https://${forwardedHost}` : origin

  if (code) {
    const cookieStore = cookies()

    // Collect cookies that Supabase wants to set so we can attach them to the
    // redirect response — Next.js Route Handlers do NOT automatically forward
    // cookieStore mutations into a NextResponse.redirect().
    const cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }> = []

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            cookiesToSet.push({ name, value, options })
          },
          remove(name: string, options: CookieOptions) {
            cookiesToSet.push({ name, value: '', options })
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Build the redirect and attach the auth session cookies
      const response = NextResponse.redirect(`${redirectBase}/signup?step=3`)
      for (const { name, value, options } of cookiesToSet) {
        response.cookies.set(name, value, options)
      }
      return response
    }

    // exchangeCodeForSession failed — redirect with error so the user sees a
    // helpful message rather than silently landing at step 1
    return NextResponse.redirect(
      `${redirectBase}/signup?error=verification_failed`
    )
  }

  return NextResponse.redirect(`${redirectBase}/signup?error=verification_failed`)
}
