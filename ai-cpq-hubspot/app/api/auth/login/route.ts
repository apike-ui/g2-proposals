import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import bcryptjs from 'bcryptjs'
import { SessionData, sessionOptions } from '@/lib/session'
import { supabaseAdmin } from '@/lib/db'

/**
 * Try to look up the user in the `users` table.
 * Returns null (instead of throwing) if the table doesn't exist yet.
 */
async function lookupUser(username: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, username, display_name, password_hash, role')
      .eq('username', username)
      .single()
    if (error) return null
    return data as { id: string; username: string; display_name: string; password_hash: string; role: string }
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    // --- Try database users first ---
    const dbUser = await lookupUser(username)
    if (dbUser) {
      const valid = await bcryptjs.compare(password, dbUser.password_hash)
      if (!valid) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

      const response = NextResponse.json({ success: true, username: dbUser.username, role: dbUser.role })
      const session = await getIronSession<SessionData>(request, response, sessionOptions)
      session.userId = dbUser.id
      session.username = dbUser.username
      session.displayName = dbUser.display_name || dbUser.username
      session.role = dbUser.role as 'admin' | 'user'
      session.isLoggedIn = true
      await session.save()
      return response
    }

    // --- Fallback: env-var credentials (works before users table is created) ---
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

    if (!isValid) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

    const response = NextResponse.json({ success: true, username: validUsername, role: 'admin' })
    const session = await getIronSession<SessionData>(request, response, sessionOptions)
    session.userId = 'env-admin'
    session.username = validUsername
    session.displayName = validUsername
    session.role = 'admin'
    session.isLoggedIn = true
    await session.save()
    return response
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
