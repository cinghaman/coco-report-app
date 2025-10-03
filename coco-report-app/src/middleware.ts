import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // This will refresh session if expired - required for Server Components
  const { data: { user } } = await supabase.auth.getUser()

  // Only redirect to login if user is not signed in and trying to access protected routes
  if (!user && !request.nextUrl.pathname.startsWith('/login') && request.nextUrl.pathname !== '/') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Don't redirect authenticated users from login page - let the login page handle role-based redirects

  return response
}

export const config = {
  matcher: [
    // Skip all internal paths (_next) and login page
    '/((?!_next/static|_next/image|favicon.ico|login).*)',
  ],
}
