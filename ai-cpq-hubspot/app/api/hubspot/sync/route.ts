import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'
import { syncProductToHubSpot } from '@/lib/hubspot'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productIds } = body

    let query = supabaseAdmin.from('products').select('*')
    if (productIds && productIds.length > 0) {
      query = query.in('id', productIds)
    }

    const { data: products, error } = await query
    if (error) throw error

    type ProductRow = { id: string; sku: string; name: string; description: string | null; price: number }
    const results = { synced: 0, errors: [] as string[] }

    for (const product of (products as ProductRow[]) || []) {
      try {
        const hubspotId = await syncProductToHubSpot({
          sku: product.sku,
          name: product.name,
          description: product.description,
          price: product.price,
        })

        await supabaseAdmin
          .from('products')
          .update({ hubspot_product_id: hubspotId, updated_at: new Date().toISOString() })
          .eq('id', product.id)

        results.synced++
      } catch (err) {
        results.errors.push(`${product.sku}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    return NextResponse.json(results)
  } catch (err) {
    console.error('HubSpot sync error:', err)
    return NextResponse.json({ error: 'Failed to sync with HubSpot' }, { status: 500 })
  }
}
