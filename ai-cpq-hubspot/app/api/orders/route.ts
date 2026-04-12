import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function genOrderNumber() {
  const d = new Date()
  return `ORD-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}-${Math.floor(Math.random() * 9000) + 1000}`
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let query = supabaseAdmin
      .from('orders')
      .select('*, quote:quotes(quote_number, customer_name)')
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ orders: data })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { quoteId, customerName, customerEmail, customerCompany, shippingAddress, notes } = body

    let totalAmount = 0
    let quoteInfo = null

    if (quoteId) {
      const { data: q } = await supabaseAdmin
        .from('quotes')
        .select('total_amount, customer_name, customer_email, customer_company')
        .eq('id', quoteId).single()
      if (q) { totalAmount = q.total_amount; quoteInfo = q }
    }

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .insert({
        order_number: genOrderNumber(),
        quote_id: quoteId || null,
        customer_name: customerName || quoteInfo?.customer_name || null,
        customer_email: customerEmail || quoteInfo?.customer_email || null,
        customer_company: customerCompany || quoteInfo?.customer_company || null,
        shipping_address: shippingAddress || null,
        total_amount: totalAmount,
        notes: notes || null,
        status: 'pending',
      })
      .select().single()

    if (error) throw error

    if (quoteId) {
      await supabaseAdmin
        .from('quotes')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', quoteId)
    }

    return NextResponse.json({ order }, { status: 201 })
  } catch (err) {
    console.error('Orders POST:', err)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
