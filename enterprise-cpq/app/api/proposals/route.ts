import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { SessionData, sessionOptions } from '@/lib/session'
import { supabaseAdmin } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const response = new NextResponse()
    const session = await getIronSession<SessionData>(request, response, sessionOptions)
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: proposals, error } = await supabaseAdmin
      .from('g2_proposals')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) throw error

    // Attach version counts
    const { data: versions } = await supabaseAdmin
      .from('proposal_versions')
      .select('proposal_id')

    const countMap: Record<string, number> = {}
    for (const v of versions || []) {
      countMap[v.proposal_id as string] = (countMap[v.proposal_id as string] || 0) + 1
    }

    const enriched = (proposals || []).map((p: Record<string, unknown>) => ({
      ...p,
      version_count: countMap[p.id as string] || 0,
    }))

    return NextResponse.json({ proposals: enriched })
  } catch (err) {
    console.error('Proposals GET:', err)
    return NextResponse.json({ error: 'Failed to fetch proposals' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const res = new NextResponse()
    const session = await getIronSession<SessionData>(request, res, sessionOptions)
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const name = body.name || 'Untitled Proposal'
    const customer = body.customer || ''
    const rep = body.rep || session.displayName || session.username || ''

    const { data, error } = await supabaseAdmin
      .from('g2_proposals')
      .insert({ name, customer, rep, created_by: session.userId })
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json({ proposal: data })
  } catch (err) {
    console.error('Proposals POST:', err)
    return NextResponse.json({ error: 'Failed to create proposal' }, { status: 500 })
  }
}
