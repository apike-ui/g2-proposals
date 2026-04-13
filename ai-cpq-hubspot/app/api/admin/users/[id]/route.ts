import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import bcryptjs from 'bcryptjs'
import { SessionData, sessionOptions } from '@/lib/session'
import { supabaseAdmin } from '@/lib/db'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const response = new NextResponse()
  const session = await getIronSession<SessionData>(request, response, sessionOptions)
  if (!session.isLoggedIn || (session.role && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { username, displayName, password, role } = body

  const updates: Record<string, unknown> = {
    username,
    display_name: displayName,
    role,
    updated_at: new Date().toISOString(),
  }

  if (password) {
    updates.password_hash = await bcryptjs.hash(password, 10)
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .update(updates)
    .eq('id', params.id)
    .select('id, username, display_name, role')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ user: data })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const response = new NextResponse()
  const session = await getIronSession<SessionData>(request, response, sessionOptions)
  if (!session.isLoggedIn || (session.role && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Prevent deleting the last admin
  const { data: admins } = await supabaseAdmin.from('users').select('id').eq('role', 'admin')
  const { data: target } = await supabaseAdmin.from('users').select('role').eq('id', params.id).single()

  if (target?.role === 'admin' && (admins?.length || 0) <= 1) {
    return NextResponse.json({ error: 'Cannot delete the last admin user' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('users').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
