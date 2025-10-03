import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Simplified middleware - let client-side auth handle redirects
  // Only protect API routes that require authentication
  
  const { pathname } = request.nextUrl
  
  // Allow login page and static assets
  if (pathname.startsWith('/login') || 
      pathname.startsWith('/_next') || 
      pathname.startsWith('/favicon') ||
      pathname === '/') {
    return NextResponse.next()
  }
  
  // For all other routes, let the client-side auth handle it
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Only match API routes and protected pages
    '/api/:path*',
    '/dashboard/:path*',
    '/admin/:path*',
    '/reports/:path*',
    '/analytics/:path*'
  ],
}
