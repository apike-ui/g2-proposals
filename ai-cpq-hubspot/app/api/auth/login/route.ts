import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import bcryptjs from 'bcryptjs'
import { SessionData, sessionOptions } from '@/lib/session'
import { supabaseAdmin } from '@/lib/db'

// On first boot with an empty users table, seed the admin from env vars.
async function ensureAdminSeeded() {
  try {
    const { data } = await supabaseAdmin.from('users').select('id').limit(1)
    if (data && data.length > 0) return

    const username = process.env.ADMIN_USERNAME || 'JamesPike'
    const plainPassword = process.env.ADMIN_PASSWORD || 'Soccer123'
    const existingHash = process.env.ADMIN_PASSWORD_HASH
    const passwordHash = existingHash || await bcryptjs.hash(plainPassword, 10)

    await supabaseAdmin.from('users').insert({
      username,
      display_name: username,
      password_hash: passwordHash,
      role: 'admin',
    })
  } catch {
    // Table may not exist yet — handled gracefully
  }
}

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    await ensureAdminSeeded()

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, username, display_name, password_hash, role')
      .eq('username', username)
      .single()

    if (error || !user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const isValid = await bcryptjs.compare(password, user.password_hash)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const response = NextResponse.json({
      success: true,
      username: user.username,
      role: user.role,
    })
    const session = await getIronSession<SessionData>(request, response, sessionOptions)
    session.userId = user.id
    session.username = user.username
    session.displayName = user.display_name || user.username
    session.role = user.role
    session.isLoggedIn = true
    await session.save()

    return response
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
