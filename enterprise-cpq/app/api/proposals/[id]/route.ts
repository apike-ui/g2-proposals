import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { SessionData, sessionOptions } from '@/lib/session'
import { supabaseAdmin } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const res = new NextResponse()
    const session = await getIronSession<SessionData>(request, res, sessionOptions)
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: proposal, error } = await supabaseAdmin
      .from('g2_proposals')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })

    // Load latest version snapshot
    const { data: versions } = await supabaseAdmin
      .from('proposal_versions')
      .select('*')
      .eq('proposal_id', params.id)
      .order('version_number', { ascending: false })

    const latestVersion = (versions || [])[0] || null

    return NextResponse.json({ proposal, latestVersion })
  } catch (err) {
    console.error('Proposal GET:', err)
    return NextResponse.json({ error: 'Failed to fetch proposal' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const res = new NextResponse()
    const session = await getIronSession<SessionData>(request, res, sessionOptions)
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.name !== undefined) updates.name = body.name
    if (body.customer !== undefined) updates.customer = body.customer
    if (body.rep !== undefined) updates.rep = body.rep
    if (body.grand_total !== undefined) updates.grand_total = body.grand_total
    if (body.rate_card_id !== undefined) updates.rate_card_id = body.rate_card_id || null

    const { data, error } = await supabaseAdmin
      .from('g2_proposals')
      .update(updates)
      .eq('id', params.id)
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json({ proposal: data })
  } catch (err) {
    console.error('Proposal PUT:', err)
    return NextResponse.json({ error: 'Failed to update proposal' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const res = new NextResponse()
    const session = await getIronSession<SessionData>(request, res, sessionOptions)
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabaseAdmin.from('g2_proposals').delete().eq('id', params.id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Proposal DELETE:', err)
    return NextResponse.json({ error: 'Failed to delete proposal' }, { status: 500 })
  }
}
