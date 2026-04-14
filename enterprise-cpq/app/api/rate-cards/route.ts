import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { SessionData, sessionOptions } from '@/lib/session'
import { supabaseAdmin } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const res = new NextResponse()
    const session = await getIronSession<SessionData>(request, res, sessionOptions)
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabaseAdmin
      .from('rate_cards')
      .select('id, name, customer, owner, created_at, updated_at, created_by')
      .order('updated_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ rateCards: data || [] })
  } catch (err) {
    console.error('Rate cards GET:', err)
    return NextResponse.json({ error: 'Failed to fetch rate cards' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const res = new NextResponse()
    const session = await getIronSession<SessionData>(request, res, sessionOptions)
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))

    const { data, error } = await supabaseAdmin
      .from('rate_cards')
      .insert({
        name: body.name || 'Untitled Rate Card',
        customer: body.customer || '',
        owner: body.owner || session.displayName || session.username || '',
        card_data: body.card_data || { basePkgs: {}, addons: {}, nonAcv: {} },
        created_by: session.userId,
      })
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json({ rateCard: data })
  } catch (err) {
    console.error('Rate cards POST:', err)
    return NextResponse.json({ error: 'Failed to create rate card' }, { status: 500 })
  }
}
