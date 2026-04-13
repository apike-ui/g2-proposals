import { NextRequest, NextResponse } from 'next/server'
import { parseExcelFile, generateExcelTemplate } from '@/lib/excel'
import { supabaseAdmin } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!file.name.match(/\.(xlsx|xls|csv)$/i))
      return NextResponse.json({ error: 'Please upload an Excel or CSV file' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const products = await parseExcelFile(buffer)

    // Create a batch record
    let batchId: string | null = null
    try {
      const { data: batch } = await supabaseAdmin
        .from('upload_batches').insert({ filename: file.name }).select().single()
      batchId = (batch as Record<string,string> | null)?.id || null
    } catch { /* batch tracking is optional */ }

    const results = { created: 0, updated: 0, errors: [] as string[] }
    for (const product of products) {
      try {
        const { data: existing } = await supabaseAdmin
          .from('products').select('id').eq('sku', product.sku).single()
        if (existing) {
          const { error } = await supabaseAdmin.from('products').update({
            name: product.name, description: product.description || null,
            price: product.price || 0, category: product.category || null,
            unit: product.unit || 'each', updated_at: new Date().toISOString(),
          }).eq('id', (existing as Record<string,string>).id)
          if (error) results.errors.push(`Update failed for ${product.sku}: ${error.message}`)
          else results.updated++
        } else {
          const insertData: Record<string, unknown> = {
            sku: product.sku, name: product.name, description: product.description || null,
            price: product.price || 0, category: product.category || null, unit: product.unit || 'each',
          }
          if (batchId) insertData.batch_id = batchId
          const { error } = await supabaseAdmin.from('products').insert(insertData)
          if (error) results.errors.push(`Create failed for ${product.sku}: ${error.message}`)
          else results.created++
        }
      } catch { results.errors.push(`Error processing ${product.sku}`) }
    }
    return NextResponse.json({ success: true, total: products.length, ...results })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to process file' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const buffer = await generateExcelTemplate()
    return new NextResponse(buffer.buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="cpq-product-template.xlsx"',
      },
    })
  } catch { return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 }) }
}
