import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'
import { suggestProducts } from '@/lib/ai'

// Extend Vercel's default 10s limit to 30s for AI calls
export const maxDuration = 30

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

    const { data: products } = await supabaseAdmin
      .from('products')
      .select('sku, name, description, price')
      .limit(25)

    type ProductRow = { sku: string; name: string; description: string | null; price: number }
    const result = await suggestProducts(requirement, (products as ProductRow[]) || [])
    return NextResponse.json(result)
  } catch (err) {
    console.error('AI suggest error:', err)
    // Return a graceful fallback instead of a 500 error
    return NextResponse.json({
      suggestions: [],
      summary: 'AI suggestions temporarily unavailable. Please browse the product catalog manually.',
    })
  }
}
