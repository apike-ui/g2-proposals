import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { SessionData, sessionOptions } from '@/lib/session'

const PUBLIC_PATHS = ['/login', '/api/auth/login']
const ADMIN_ONLY_PATHS = ['/upload', '/integrations', '/settings', '/rules', '/api/upload', '/api/integrations', '/api/admin', '/api/rules']

function isAdminOnly(p: string) { return ADMIN_ONLY_PATHS.some((a) => p.startsWith(a)) }

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next()

  if (pathname.startsWith('/api/')) {
    const res = NextResponse.next()
    const session = await getIronSession<SessionData>(request, res, sessionOptions)
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // Treat undefined role as admin for backward compatibility
    const isAdmin = !session.role || session.role === 'admin'
    if (isAdminOnly(pathname) && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return res
  }

  const res = NextResponse.next()
  const session = await getIronSession<SessionData>(request, res, sessionOptions)
  if (!session.isLoggedIn) return NextResponse.redirect(new URL('/login', request.url))
  const isAdmin = !session.role || session.role === 'admin'
  if (isAdminOnly(pathname) && !isAdmin) return NextResponse.redirect(new URL('/dashboard', request.url))
  return res
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'] }
