import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import bcryptjs from 'bcryptjs'
import { SessionData, sessionOptions } from '@/lib/session'
import { supabaseAdmin } from '@/lib/db'

async function getOrSeedAdmin() {
  const username = process.env.ADMIN_USERNAME || 'JamesPike'
  const plainPassword = process.env.ADMIN_PASSWORD || 'Soccer123'

  try {
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id, username, display_name, role, password_hash')
      .eq('username', username)
      .single()

    if (existing) return existing

    const hash = await bcryptjs.hash(plainPassword, 10)
    const { data: created } = await supabaseAdmin
      .from('users')
      .insert({ username, display_name: username, password_hash: hash, role: 'admin' })
      .select('id, username, display_name, role')
      .single()

    return created
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password } = body

    // Try DB first
    try {
      const { data: dbUser } = await supabaseAdmin
        .from('users')
        .select('id, username, display_name, role, password_hash')
        .eq('username', username)
        .single()

      if (dbUser && dbUser.password_hash) {
        const valid = await bcryptjs.compare(password, dbUser.password_hash)
        if (!valid) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

        const response = NextResponse.json({ success: true, username: dbUser.username })
        const session = await getIronSession<SessionData>(request, response, sessionOptions)
        session.userId = dbUser.id
        session.username = dbUser.username
        session.displayName = dbUser.display_name || dbUser.username
        session.role = dbUser.role || 'admin'
        session.isLoggedIn = true
        await session.save()
        return response
      }
    } catch {
      // Fall through to env-var check
    }

    // Env-var fallback
    const validUsername = process.env.ADMIN_USERNAME || 'JamesPike'
    const validPasswordPlain = process.env.ADMIN_PASSWORD || 'Soccer123'
    const validPasswordHash = process.env.ADMIN_PASSWORD_HASH

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

    const seeded = await getOrSeedAdmin()

    const response = NextResponse.json({ success: true, username })
    const session = await getIronSession<SessionData>(request, response, sessionOptions)
    session.userId = seeded?.id || 'env-admin'
    session.username = username
    session.displayName = seeded?.display_name || username
    session.role = 'admin'
    session.isLoggedIn = true
    await session.save()

    return response
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
