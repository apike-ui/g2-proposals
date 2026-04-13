import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'
import { suggestProducts } from '@/lib/ai'

export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const { requirement } = await request.json()
    if (!requirement || requirement.trim().length < 5) {
      return NextResponse.json({ error: 'Please provide a more detailed requirement' }, { status: 400 })
    }
    const { data: products, error } = await supabaseAdmin
      .from('products').select('sku, name, description, price').limit(25)
    if (error) throw error
    type ProductRow = { sku: string; name: string; description: string | null; price: number }
    const result = await suggestProducts(requirement, (products as ProductRow[]) || [])
    return NextResponse.json(result)
  } catch (err) {
    console.error('AI suggest error:', err)
    return NextResponse.json({ error: 'AI request timed out. Try a shorter requirement or check your API key.' }, { status: 500 })
  }
}
