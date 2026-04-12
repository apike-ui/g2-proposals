import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const category = searchParams.get('category')

    let query = supabaseAdmin
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })

    if (search) {
      query = query.or(
        `sku.ilike.%${search}%,name.ilike.%${search}%,description.ilike.%${search}%`,
      )
    }
    if (category) {
      query = query.eq('category', category)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ products: data })
  } catch (err) {
    console.error('Products GET:', err)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sku, name, description, price, category, unit } = body

    if (!sku || !name) {
      return NextResponse.json({ error: 'SKU and name are required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('products')
      .insert({ sku, name, description, price: price || 0, category, unit: unit || 'each' })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A product with this SKU already exists' }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ product: data }, { status: 201 })
  } catch (err) {
    console.error('Products POST:', err)
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}
