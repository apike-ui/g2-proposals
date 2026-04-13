import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { SessionData, sessionOptions } from '@/lib/session'

const PUBLIC_PATHS = ['/login', '/api/auth/login']

// Routes only admins may access
const ADMIN_ONLY_PATHS = [
  '/upload',
  '/integrations',
  '/settings',
  '/api/upload',
  '/api/integrations',
  '/api/admin',
]

function isAdminOnly(pathname: string) {
  return ADMIN_ONLY_PATHS.some((p) => pathname.startsWith(p))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // API routes: return JSON errors
  if (pathname.startsWith('/api/')) {
    const res = NextResponse.next()
    const session = await getIronSession<SessionData>(request, res, sessionOptions)
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (isAdminOnly(pathname) && session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return res
  }

  // Page routes: redirect to login
  const res = NextResponse.next()
  const session = await getIronSession<SessionData>(request, res, sessionOptions)
  if (!session.isLoggedIn) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (isAdminOnly(pathname) && session.role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
}
