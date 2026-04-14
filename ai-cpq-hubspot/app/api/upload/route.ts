import { NextRequest, NextResponse } from 'next/server'
import { parseExcelFile, generateExcelTemplate } from '@/lib/excel'
import { supabaseAdmin } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      return NextResponse.json({ error: 'Please upload an Excel (.xlsx, .xls) or CSV file' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const products = await parseExcelFile(buffer)

    // Create upload batch record
    let batchId: string | null = null
    try {
      const { data: batch } = await supabaseAdmin
        .from('upload_batches')
        .insert({ filename: file.name })
        .select('id')
        .single()
      batchId = batch?.id || null
    } catch {
      // batch tracking is optional
    }

    const results = { created: 0, updated: 0, errors: [] as string[] }

    for (const product of products) {
      try {
        const { data: existing } = await supabaseAdmin
          .from('products').select('id').eq('sku', product.sku).single()

        if (existing) {
          const updatePayload: Record<string, unknown> = {
            name: product.name,
            description: product.description || null,
            price: product.price || 0,
            category: product.category || null,
            unit: product.unit || 'each',
            updated_at: new Date().toISOString(),
          }
          if (batchId) updatePayload.batch_id = batchId

          const { error } = await supabaseAdmin
            .from('products')
            .update(updatePayload)
            .eq('id', existing.id)

          if (error) results.errors.push(`Update failed for ${product.sku}: ${error.message}`)
          else results.updated++
        } else {
          const insertPayload: Record<string, unknown> = {
            sku: product.sku,
            name: product.name,
            description: product.description || null,
            price: product.price || 0,
            category: product.category || null,
            unit: product.unit || 'each',
          }
          if (batchId) insertPayload.batch_id = batchId

          const { error } = await supabaseAdmin.from('products').insert(insertPayload)

          if (error) results.errors.push(`Create failed for ${product.sku}: ${error.message}`)
          else results.created++
        }
      } catch {
        results.errors.push(`Error processing ${product.sku}`)
      }
    }

    return NextResponse.json({ success: true, total: products.length, batchId, ...results })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to process file' },
      { status: 500 },
    )
  }
}

export async function GET() {
  const buffer = await generateExcelTemplate()
  return new NextResponse(buffer.buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="cpq-product-template.xlsx"',
    },
  })
}
