import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import bcryptjs from 'bcryptjs'
import { SessionData, sessionOptions } from '@/lib/session'
import { supabaseAdmin } from '@/lib/db'

export async function PUT(request: NextRequest) {
  try {
    const res = new NextResponse()
    const session = await getIronSession<SessionData>(request, res, sessionOptions)
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { displayName, username, currentPassword, newPassword } = body

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, username, password_hash')
      .eq('id', session.userId)
      .single()

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Current password is required to set a new password' }, { status: 400 })
      }
      const valid = await bcryptjs.compare(currentPassword, (user as { password_hash: string }).password_hash)
      if (!valid) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
      }
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (displayName) updates.display_name = displayName
    if (username) updates.username = username
    if (newPassword) updates.password_hash = await bcryptjs.hash(newPassword, 10)

    const { error } = await supabaseAdmin.from('users').update(updates).eq('id', session.userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Update the session so changes are reflected immediately
    const response = NextResponse.json({ success: true, username: username || session.username, displayName: displayName || session.displayName })
    const updatedSession = await getIronSession<SessionData>(request, response, sessionOptions)
    updatedSession.userId = session.userId
    updatedSession.username = username || session.username
    updatedSession.displayName = displayName || session.displayName
    updatedSession.role = session.role
    updatedSession.isLoggedIn = true
    await updatedSession.save()

    return response
  } catch (err) {
    console.error('Settings PUT:', err)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
