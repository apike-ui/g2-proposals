import { NextRequest, NextResponse } from 'next/server'
import { getHubSpotContacts } from '@/lib/hubspot'

export async function GET() {
  try {
    const contacts = await getHubSpotContacts(100)
    return NextResponse.json({ contacts })
  } catch (err) {
    console.error('HubSpot contacts error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch HubSpot contacts' },
      { status: 500 },
    )
  }
}
