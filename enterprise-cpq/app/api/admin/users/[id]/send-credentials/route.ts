import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import bcryptjs from 'bcryptjs'
import { SessionData, sessionOptions } from '@/lib/session'
import { supabaseAdmin } from '@/lib/db'

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM || 'noreply@g2-proposals.vercel.app'

  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY is not configured' }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return { ok: false, error: (err as { message?: string }).message || `Resend error ${res.status}` }
  }
  return { ok: true }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const response = new NextResponse()
    const session = await getIronSession<SessionData>(request, response, sessionOptions)
    if (!session.isLoggedIn || session.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, username, display_name, email')
      .eq('id', params.id)
      .single()

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (!user.email) return NextResponse.json({ error: 'User has no email address. Edit the user to add one first.' }, { status: 400 })

    const tempPassword = generateTempPassword()
    const passwordHash = await bcryptjs.hash(tempPassword, 10)

    await supabaseAdmin
      .from('users')
      .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
      .eq('id', params.id)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://g2-proposals.vercel.app'
    const name = user.display_name || user.username

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#ffffff">
        <h2 style="margin:0 0 8px;font-size:20px;color:#111827">Your login credentials</h2>
        <p style="margin:0 0 24px;color:#6b7280;font-size:15px">Hi ${name}, an account has been created for you on the G2 Proposal Builder.</p>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:24px">
          <p style="margin:0 0 8px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Login URL</p>
          <a href="${appUrl}/login" style="color:#2563eb;font-size:15px">${appUrl}/login</a>
          <p style="margin:16px 0 8px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Username</p>
          <p style="margin:0;font-size:16px;font-weight:600;color:#111827;letter-spacing:.02em">${user.username}</p>
          <p style="margin:16px 0 8px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Temporary Password</p>
          <p style="margin:0;font-size:16px;font-weight:600;color:#111827;letter-spacing:.08em;font-family:monospace">${tempPassword}</p>
        </div>
        <p style="margin:0;color:#9ca3af;font-size:13px">Please change your password after first login via Settings → My Profile.</p>
      </div>
    `

    const emailResult = await sendEmail(user.email as string, 'Your G2 Proposal Builder credentials', html)
    if (!emailResult.ok) {
      return NextResponse.json({ error: emailResult.error, tempPassword }, { status: 500 })
    }

    return NextResponse.json({ success: true, tempPassword, sentTo: user.email })
  } catch (err) {
    console.error('Send credentials:', err)
    return NextResponse.json({ error: 'Failed to send credentials' }, { status: 500 })
  }
}
