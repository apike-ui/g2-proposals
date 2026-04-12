import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data: quote, error } = await supabaseAdmin
      .from('quotes').select('*').eq('id', params.id).single()
    if (error || !quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

    const { data: items, error: iErr } = await supabaseAdmin
      .from('quote_items')
      .select('*, product:products(*)')
      .eq('quote_id', params.id)

    if (iErr) throw iErr
    return NextResponse.json({ quote: { ...quote, items } })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch quote' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { status, customerName, customerEmail, customerCompany, notes, validUntil, aiSummary, hubspotDealId, items } = body

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (status !== undefined) updateData.status = status
    if (customerName !== undefined) updateData.customer_name = customerName
    if (customerEmail !== undefined) updateData.customer_email = customerEmail
    if (customerCompany !== undefined) updateData.customer_company = customerCompany
    if (notes !== undefined) updateData.notes = notes
    if (validUntil !== undefined) updateData.valid_until = validUntil
    if (aiSummary !== undefined) updateData.ai_summary = aiSummary
    if (hubspotDealId !== undefined) updateData.hubspot_deal_id = hubspotDealId

    if (items !== undefined) {
      updateData.total_amount = items.reduce(
        (sum: number, i: { total_price: number }) => sum + (i.total_price || 0), 0,
      )
    }

    const { data: quote, error } = await supabaseAdmin
      .from('quotes').update(updateData).eq('id', params.id).select().single()
    if (error) throw error

    if (items !== undefined) {
      await supabaseAdmin.from('quote_items').delete().eq('quote_id', params.id)
      if (items.length > 0) {
        const rows = items.map((item: {
          product_id: string; quantity: number; unit_price: number;
          discount_percent?: number; total_price: number; notes?: string
        }) => ({
          quote_id: params.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent || 0,
          total_price: item.total_price,
          notes: item.notes || null,
        }))
        await supabaseAdmin.from('quote_items').insert(rows)
      }
    }

    return NextResponse.json({ quote })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update quote' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error } = await supabaseAdmin.from('quotes').delete().eq('id', params.id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete quote' }, { status: 500 })
  }
}
