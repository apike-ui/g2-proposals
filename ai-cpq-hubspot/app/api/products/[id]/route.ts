import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data, error } = await supabaseAdmin
      .from('products').select('*').eq('id', params.id).single()
    if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ product: data })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { sku, name, description, price, category, unit } = body

    const { data, error } = await supabaseAdmin
      .from('products')
      .update({ sku, name, description, price, category, unit, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select().single()

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'SKU already exists' }, { status: 409 })
      throw error
    }
    return NextResponse.json({ product: data })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error } = await supabaseAdmin.from('products').delete().eq('id', params.id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
  }
}
