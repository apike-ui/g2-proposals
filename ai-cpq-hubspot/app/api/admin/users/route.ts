import { NextRequest, NextResponse } from 'next/server'
import bcryptjs from 'bcryptjs'
import { supabaseAdmin } from '@/lib/db'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, username, display_name, role, created_at')
      .order('created_at', { ascending: true })
    if (error) throw error
    return NextResponse.json({ users: data })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { username, displayName, password, role } = await request.json()
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 })
    }
    const passwordHash = await bcryptjs.hash(password, 10)
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert({ username, display_name: displayName || username, password_hash: passwordHash, role: role || 'user' })
      .select('id, username, display_name, role, created_at')
      .single()
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Username already exists' }, { status: 409 })
      throw error
    }
    return NextResponse.json({ user: data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
