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
      .select('id, proposal_id, notes, version_number, created_at')
      .eq('proposal_id', params.id)
      .order('version_number', { ascending: false })

    if (error) throw error
    return NextResponse.json({ versions: data || [] })
  } catch (err) {
    console.error('Versions GET:', err)
    return NextResponse.json({ error: 'Failed to fetch versions' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const res = new NextResponse()
    const session = await getIronSession<SessionData>(request, res, sessionOptions)
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { snapshot, notes, grandTotal } = body

    if (!snapshot) return NextResponse.json({ error: 'snapshot is required' }, { status: 400 })

    // Get next version number
    const { data: existing } = await supabaseAdmin
      .from('proposal_versions')
      .select('version_number')
      .eq('proposal_id', params.id)
      .order('version_number', { ascending: false })

    const nextVersion = ((existing || [])[0]?.version_number as number || 0) + 1

    const { data, error } = await supabaseAdmin
      .from('proposal_versions')
      .insert({
        proposal_id: params.id,
        snapshot,
        notes: notes || '',
        version_number: nextVersion,
      })
      .select('*')
      .single()

    if (error) throw error

    // Update parent proposal grand_total + updated_at
    if (grandTotal != null) {
      await supabaseAdmin
        .from('g2_proposals')
        .update({ grand_total: grandTotal, updated_at: new Date().toISOString() })
        .eq('id', params.id)
    }

    return NextResponse.json({ version: data })
  } catch (err) {
    console.error('Versions POST:', err)
    return NextResponse.json({ error: 'Failed to save version' }, { status: 500 })
  }
}
