import { NextRequest, NextResponse } from 'next/server'
import bcryptjs from 'bcryptjs'
import { supabaseAdmin } from '@/lib/db'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { username, displayName, password, role } = await request.json()
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (username) updates.username = username
    if (displayName) updates.display_name = displayName
    if (role) updates.role = role
    if (password) updates.password_hash = await bcryptjs.hash(password, 10)

    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', params.id)
      .select('id, username, display_name, role')
      .single()
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Username already exists' }, { status: 409 })
      throw error
    }
    return NextResponse.json({ user: data })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Prevent deleting all admins
    const { data: admins } = await supabaseAdmin
      .from('users').select('id').eq('role', 'admin')
    const isLastAdmin = admins && admins.length === 1 && admins[0].id === params.id
    if (isLastAdmin) {
      return NextResponse.json({ error: 'Cannot delete the last administrator' }, { status: 400 })
    }
    const { error } = await supabaseAdmin.from('users').delete().eq('id', params.id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
