import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { SessionData, sessionOptions } from '@/lib/session'
import { supabaseAdmin } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const res = new NextResponse()
    const session = await getIronSession<SessionData>(request, res, sessionOptions)
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabaseAdmin
      .from('proposal_versions')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    return NextResponse.json({ version: data })
  } catch (err) {
    console.error('Version GET:', err)
    return NextResponse.json({ error: 'Failed to fetch version' }, { status: 500 })
  }
}
