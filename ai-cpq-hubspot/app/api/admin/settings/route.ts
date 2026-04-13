import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import bcryptjs from 'bcryptjs'
import { SessionData, sessionOptions } from '@/lib/session'
import { supabaseAdmin } from '@/lib/db'

export async function PUT(request: NextRequest) {
  try {
    const res = NextResponse.next()
    const session = await getIronSession<SessionData>(request, res, sessionOptions)
    if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { username, displayName, currentPassword, newPassword } = await request.json()

    // Verify current password before allowing changes
    const { data: user } = await supabaseAdmin
      .from('users').select('password_hash').eq('id', session.userId).single()
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const passwordOk = await bcryptjs.compare(currentPassword, user.password_hash)
    if (!passwordOk) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (username) updates.username = username
    if (displayName) updates.display_name = displayName
    if (newPassword) updates.password_hash = await bcryptjs.hash(newPassword, 10)

    const { data, error } = await supabaseAdmin
      .from('users').update(updates).eq('id', session.userId)
      .select('id, username, display_name, role').single()
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
      throw error
    }
    return NextResponse.json({ user: data })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
