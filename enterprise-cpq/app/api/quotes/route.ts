import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'

function genQuoteNumber() {
  const d = new Date()
  return `Q-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}-${Math.floor(Math.random() * 9000) + 1000}`
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    let query = supabaseAdmin
      .from('quotes').select('*').order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (search) {
      query = query.or(
        `quote_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_company.ilike.%${search}%`,
      )
    }

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ quotes: data })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { customerName, customerEmail, customerCompany, notes, validUntil, items, rate_card_id } = body

    const quoteNumber = genQuoteNumber()
    const total = (items || []).reduce(
      (sum: number, item: { total_price: number }) => sum + (item.total_price || 0), 0,
    )

    const { data: quote, error: qErr } = await supabaseAdmin
      .from('quotes')
      .insert({
        quote_number: quoteNumber,
        customer_name: customerName || null,
        customer_email: customerEmail || null,
        customer_company: customerCompany || null,
        notes: notes || null,
        valid_until: validUntil || null,
        total_amount: total,
        status: 'draft',
        rate_card_id: rate_card_id || null,
      })
      .select().single()

    if (qErr) throw qErr

    if (items && items.length > 0) {
      const quoteItems = items.map((item: {
        product_id: string; quantity: number; unit_price: number;
        discount_percent?: number; total_price: number; notes?: string
      }) => ({
        quote_id: quote.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent || 0,
        total_price: item.total_price,
        notes: item.notes || null,
      }))

      const { error: iErr } = await supabaseAdmin.from('quote_items').insert(quoteItems)
      if (iErr) throw iErr
    }

    return NextResponse.json({ quote }, { status: 201 })
  } catch (err) {
    console.error('Quotes POST:', err)
    return NextResponse.json({ error: 'Failed to create quote' }, { status: 500 })
  }
}
