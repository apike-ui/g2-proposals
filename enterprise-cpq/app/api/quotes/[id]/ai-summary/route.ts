import { NextRequest, NextResponse } from 'next/server'
import { generateQuoteSummary } from '@/lib/ai'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { customerName, customerCompany, items, total, notes } = body

    const summary = await generateQuoteSummary({
      customerName: customerName || 'Valued Customer',
      customerCompany: customerCompany || '',
      items: items || [],
      total: total || 0,
      notes: notes || '',
    })

    return NextResponse.json({ summary })
  } catch (err) {
    console.error('AI summary error:', err)
    return NextResponse.json({ error: 'Failed to generate AI summary' }, { status: 500 })
  }
}
