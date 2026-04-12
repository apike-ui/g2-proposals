import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { suggestProducts } from '@/lib/ai'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { requirement } = body

    if (!requirement || requirement.trim().length < 5) {
      return NextResponse.json(
        { error: 'Please provide a more detailed requirement (at least 5 characters)' },
        { status: 400 },
      )
    }

    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select('sku, name, description, price')
      .limit(80)

    if (error) throw error

    const result = await suggestProducts(requirement, products || [])
    return NextResponse.json(result)
  } catch (err) {
    console.error('AI suggest error:', err)
    return NextResponse.json({ error: 'Failed to get AI suggestions' }, { status: 500 })
  }
}
