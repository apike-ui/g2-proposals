import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createHubSpotDeal } from '@/lib/hubspot'

function genOrderNumber() {
  const d = new Date()
  return `ORD-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}-${Math.floor(Math.random() * 9000) + 1000}`
}

// Convert a quote to an order
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { shippingAddress, notes, syncToHubSpot } = body

    const { data: quote, error } = await supabaseAdmin
      .from('quotes').select('*').eq('id', params.id).single()
    if (error || !quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

    let hubspotDealId = null
    if (syncToHubSpot) {
      try {
        hubspotDealId = await createHubSpotDeal({
          dealname: `${quote.quote_number} - ${quote.customer_company || quote.customer_name || 'Order'}`,
          amount: quote.total_amount,
        })
      } catch (e) {
        console.warn('HubSpot deal creation failed (continuing):', e)
      }
    }

    const { data: order, error: oErr } = await supabaseAdmin
      .from('orders')
      .insert({
        order_number: genOrderNumber(),
        quote_id: params.id,
        customer_name: quote.customer_name,
        customer_email: quote.customer_email,
        customer_company: quote.customer_company,
        shipping_address: shippingAddress || null,
        total_amount: quote.total_amount,
        hubspot_deal_id: hubspotDealId,
        notes: notes || null,
        status: 'pending',
      })
      .select().single()

    if (oErr) throw oErr

    // Mark quote as accepted
    await supabaseAdmin
      .from('quotes')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', params.id)

    return NextResponse.json({ order }, { status: 201 })
  } catch (err) {
    console.error('Convert to order error:', err)
    return NextResponse.json({ error: 'Failed to convert quote to order' }, { status: 500 })
  }
}
