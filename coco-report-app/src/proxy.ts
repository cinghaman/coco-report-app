import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
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
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
          })
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if expired - required for Server Components
  // https://supabase.com/docs/guides/auth/server-side/nextjs
  // Use getUser() (not getSession()) – validates JWT server-side.
  const { data: { user } } = await supabase.auth.getUser()

  const copyCookiesTo = (target: NextResponse) => {
    response.cookies.getAll().forEach(({ name, value }) =>
      target.cookies.set(name, value)
    )
  }

  // Allow access to login, auth callback, and pending approval (no auth required)
  const path = request.nextUrl.pathname
  if (
    path.startsWith('/login') ||
    path.startsWith('/auth') ||
    path.startsWith('/pending-approval')
  ) {
    return response
  }

  // Protect app routes - redirect to login if not authenticated
  const protectedPaths = ['/dashboard', '/reports', '/admin', '/analytics']
  const isProtected = protectedPaths.some((p) => path.startsWith(p))
  if (isProtected && !user) {
    const redirectRes = NextResponse.redirect(new URL('/login', request.url))
    copyCookiesTo(redirectRes)
    return redirectRes
  }

  // Check if user is approved (for authenticated users on protected routes)
  if (user && isProtected) {
    const { data: userProfile } = await supabase
      .from('users')
      .select('approved, email')
      .eq('id', user.id)
      .single()

    const superAdminEmails = ['admin@thoughtbulb.dev', 'shetty.aneet@gmail.com']
    const isSuperAdmin = userProfile?.email && superAdminEmails.includes(userProfile.email)

    if (userProfile && !userProfile.approved && !isSuperAdmin) {
      const redirectRes = NextResponse.redirect(new URL('/pending-approval', request.url))
      copyCookiesTo(redirectRes)
      return redirectRes
    }
  }

  if (path === '/' && user) {
    const redirectRes = NextResponse.redirect(new URL('/dashboard', request.url))
    copyCookiesTo(redirectRes)
    return redirectRes
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

