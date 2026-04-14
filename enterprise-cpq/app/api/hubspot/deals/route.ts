import { NextRequest, NextResponse } from 'next/server'
import { createHubSpotDeal } from '@/lib/hubspot'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { dealname, amount, contactId } = body

    if (!dealname) {
      return NextResponse.json({ error: 'Deal name is required' }, { status: 400 })
    }

    const dealId = await createHubSpotDeal({ dealname, amount: amount || 0, contactId })
    return NextResponse.json({ dealId }, { status: 201 })
  } catch (err) {
    console.error('HubSpot deal creation error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create HubSpot deal' },
      { status: 500 },
    )
  }
}
