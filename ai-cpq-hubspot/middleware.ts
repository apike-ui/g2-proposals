import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { SessionData, sessionOptions } from '@/lib/session'

const publicPaths = ['/login', '/api/auth/login']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // Protect API routes
  if (pathname.startsWith('/api/')) {
    const response = NextResponse.next()
    const session = await getIronSession<SessionData>(request, response, sessionOptions)
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return response
  }

  // Protect page routes
  const response = NextResponse.next()
  const session = await getIronSession<SessionData>(request, response, sessionOptions)
  if (!session.isLoggedIn) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
}
