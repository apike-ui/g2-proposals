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
      .from('rate_cards')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) return NextResponse.json({ error: 'Rate card not found' }, { status: 404 })

    // Count proposals using this rate card
    const { data: proposals } = await supabaseAdmin
      .from('g2_proposals')
      .select('id')
      .eq('rate_card_id', params.id)

    return NextResponse.json({ rateCard: data, proposalCount: (proposals || []).length })
  } catch (err) {
    console.error('Rate card GET:', err)
    return NextResponse.json({ error: 'Failed to fetch rate card' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const res = new NextResponse()
    const session = await getIronSession<SessionData>(request, res, sessionOptions)
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role && session.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required to edit rate cards' }, { status: 403 })
    }

    const body = await request.json()
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.name !== undefined) updates.name = body.name
    if (body.customer !== undefined) updates.customer = body.customer
    if (body.owner !== undefined) updates.owner = body.owner
    if (body.card_data !== undefined) updates.card_data = body.card_data

    const { data, error } = await supabaseAdmin
      .from('rate_cards')
      .update(updates)
      .eq('id', params.id)
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json({ rateCard: data })
  } catch (err) {
    console.error('Rate card PUT:', err)
    return NextResponse.json({ error: 'Failed to update rate card' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const res = new NextResponse()
    const session = await getIronSession<SessionData>(request, res, sessionOptions)
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role && session.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { error } = await supabaseAdmin.from('rate_cards').delete().eq('id', params.id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Rate card DELETE:', err)
    return NextResponse.json({ error: 'Failed to delete rate card' }, { status: 500 })
  }
}
