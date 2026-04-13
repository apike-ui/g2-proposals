import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import bcryptjs from 'bcryptjs'
import { SessionData, sessionOptions } from '@/lib/session'
import { supabaseAdmin } from '@/lib/db'

async function getOrSeedAdmin() {
  const username = process.env.ADMIN_USERNAME || 'JamesPike'
  const plain = process.env.ADMIN_PASSWORD || 'Soccer123'
  const hash = process.env.ADMIN_PASSWORD_HASH
  try {
    const { data } = await supabaseAdmin.from('users').select('id,username,display_name,role').eq('username', username).single()
    if (data) return data as { id: string; username: string; display_name: string; role: string }
    const passwordHash = hash || await bcryptjs.hash(plain, 10)
    const { data: created } = await supabaseAdmin.from('users')
      .insert({ username, display_name: username, password_hash: passwordHash, role: 'admin' })
      .select('id,username,display_name,role').single()
    return created as { id: string; username: string; display_name: string; role: string } | null
  } catch { return null }
}

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    // Try DB first
    try {
      const { data: dbUser } = await supabaseAdmin.from('users')
        .select('id,username,display_name,password_hash,role').eq('username', username).single()
      if (dbUser) {
        const valid = await bcryptjs.compare(password, (dbUser as Record<string,string>).password_hash)
        if (!valid) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
        const u = dbUser as Record<string,string>
        const response = NextResponse.json({ success: true, username: u.username, role: u.role })
        const session = await getIronSession<SessionData>(request, response, sessionOptions)
        session.userId = u.id; session.username = u.username
        session.displayName = u.display_name || u.username
        session.role = u.role as 'admin' | 'user'; session.isLoggedIn = true
        await session.save()
        return response
      }
    } catch { /* fall through */ }

    // Env-var fallback
    const validUsername = process.env.ADMIN_USERNAME || 'JamesPike'
    const validHash = process.env.ADMIN_PASSWORD_HASH
    const validPlain = process.env.ADMIN_PASSWORD || 'Soccer123'
    if (username !== validUsername) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    const isValid = validHash ? await bcryptjs.compare(password, validHash) : password === validPlain
    if (!isValid) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

    const seeded = await getOrSeedAdmin()
    const response = NextResponse.json({ success: true, username: validUsername, role: 'admin' })
    const session = await getIronSession<SessionData>(request, response, sessionOptions)
    session.userId = seeded?.id || 'env-admin'
    session.username = validUsername
    session.displayName = seeded?.display_name || validUsername
    session.role = 'admin'; session.isLoggedIn = true
    await session.save()
    return response
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
