import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import bcryptjs from 'bcryptjs'
import { SessionData, sessionOptions } from '@/lib/session'
import { supabaseAdmin } from '@/lib/db'

const ENV_USERNAME = process.env.ADMIN_USERNAME || 'apike'
const ENV_PASSWORD = process.env.ADMIN_PASSWORD || 'Soccer123'
const ENV_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH

async function envPasswordValid(password: string): Promise<boolean> {
  if (ENV_PASSWORD_HASH) return bcryptjs.compare(password, ENV_PASSWORD_HASH)
  return password === ENV_PASSWORD
}

// Upsert the env-var admin: update password hash if user exists, create if not
async function upsertEnvAdmin(password: string) {
  const hash = await bcryptjs.hash(password, 10)
  try {
    // Try to find any admin user matching the env username
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id, username, display_name, role')
      .eq('username', ENV_USERNAME)
      .single()

    if (existing) {
      // Update password hash so DB matches env-var credentials going forward
      await supabaseAdmin
        .from('users')
        .update({ password_hash: hash, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
      return existing
    }

    const { data: created } = await supabaseAdmin
      .from('users')
      .insert({ username: ENV_USERNAME, display_name: ENV_USERNAME, password_hash: hash, role: 'admin' })
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

    // Env-var master override — checked first so admin is never locked out
    if (username === ENV_USERNAME && await envPasswordValid(password)) {
      const user = await upsertEnvAdmin(password)
      const response = NextResponse.json({ success: true, username })
      const session = await getIronSession<SessionData>(request, response, sessionOptions)
      session.userId = user?.id || 'env-admin'
      session.username = username
      session.displayName = (user as { display_name?: string } | null)?.display_name || username
      session.role = 'admin'
      session.isLoggedIn = true
      await session.save()
      return response
    }

    // DB check for all other users
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
        session.role = dbUser.role || 'user'
        session.isLoggedIn = true
        await session.save()
        return response
      }
    } catch {
      // DB unavailable — already handled by env-var check above for admin
    }

    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
