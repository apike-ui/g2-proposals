import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import bcryptjs from 'bcryptjs'
import { SessionData, sessionOptions } from '@/lib/session'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password } = body

    const validUsername = process.env.ADMIN_USERNAME || 'JamesPike'
    const validPasswordHash = process.env.ADMIN_PASSWORD_HASH
    const validPasswordPlain = process.env.ADMIN_PASSWORD || 'Soccer123'

    if (username !== validUsername) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    let isValid = false
    if (validPasswordHash) {
      isValid = await bcryptjs.compare(password, validPasswordHash)
    } else {
      isValid = password === validPasswordPlain
    }

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const response = NextResponse.json({ success: true, username })
    const session = await getIronSession<SessionData>(request, response, sessionOptions)
    session.username = username
    session.isLoggedIn = true
    await session.save()

    return response
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
