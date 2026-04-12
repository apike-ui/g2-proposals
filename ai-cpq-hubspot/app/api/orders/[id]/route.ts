import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('*, quote:quotes(*, items:quote_items(*, product:products(*)))')
      .eq('id', params.id).single()

    if (error || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    return NextResponse.json({ order })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { status, shippingAddress, notes, hubspotDealId } = body

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (status !== undefined) updateData.status = status
    if (shippingAddress !== undefined) updateData.shipping_address = shippingAddress
    if (notes !== undefined) updateData.notes = notes
    if (hubspotDealId !== undefined) updateData.hubspot_deal_id = hubspotDealId

    const { data: order, error } = await supabaseAdmin
      .from('orders').update(updateData).eq('id', params.id).select().single()
    if (error) throw error
    return NextResponse.json({ order })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}
