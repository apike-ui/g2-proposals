import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import bcryptjs from 'bcryptjs'
import { SessionData, sessionOptions } from '@/lib/session'
import { supabaseAdmin } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const response = new NextResponse()
    const session = await getIronSession<SessionData>(request, response, sessionOptions)
    if (!session.isLoggedIn || (session.role && session.role !== 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, username, display_name, role, created_at')
      .order('created_at', { ascending: true })

    if (error) throw error
    return NextResponse.json({ users: data || [] })
  } catch (err) {
    console.error('Users GET:', err)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const response = new NextResponse()
    const session = await getIronSession<SessionData>(request, response, sessionOptions)
    if (!session.isLoggedIn || (session.role && session.role !== 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { username, displayName, password, role } = body

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 })
    }

    const passwordHash = await bcryptjs.hash(password, 10)
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert({ username, display_name: displayName || username, password_hash: passwordHash, role: role || 'user' })
      .select('id, username, display_name, role')
      .single()

    if (error) {
      const msg = error.code === '23505' ? 'Username already exists' : error.message
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    return NextResponse.json({ user: data })
  } catch (err) {
    console.error('Users POST:', err)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
