import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { supabaseAdmin } from '@/lib/db'
import { SessionData, sessionOptions } from '@/lib/session'

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
  } catch {
    return NextResponse.json({ error: 'Failed to fetch quote' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Read session (non-destructively — we just need username)
    const tmpRes = new NextResponse()
    const session = await getIronSession<SessionData>(request, tmpRes, sessionOptions)
    const username = session.username || 'system'
    const displayName = session.displayName || username

    const body = await request.json()
    const { status, customerName, customerEmail, customerCompany, notes, validUntil, aiSummary, hubspotDealId, items } = body

    // Fetch current state for audit diff
    const { data: currentQuote } = await supabaseAdmin
      .from('quotes').select('*').eq('id', params.id).single()

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

    let itemsChanged = false
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
      itemsChanged = true
    }

    // Build audit log entry (skip for internal-only updates like ai_summary, hubspot sync)
    const internalOnly = aiSummary !== undefined || hubspotDealId !== undefined
    if (!internalOnly && currentQuote) {
      const scalarFields: Array<[string, string]> = [
        ['status', 'status'],
        ['customer_name', 'customerName'],
        ['customer_email', 'customerEmail'],
        ['customer_company', 'customerCompany'],
        ['notes', 'notes'],
        ['valid_until', 'validUntil'],
      ]

      const changedFields: string[] = []
      const oldValues: Record<string, unknown> = {}
      const newValues: Record<string, unknown> = {}

      for (const [dbCol, bodyKey] of scalarFields) {
        const bodyVal = body[bodyKey]
        if (bodyVal === undefined) continue
        const oldVal = currentQuote[dbCol]
        // Normalise nullish comparisons
        const oldNorm = oldVal == null ? '' : String(oldVal)
        const newNorm = bodyVal == null ? '' : String(bodyVal)
        if (oldNorm !== newNorm) {
          changedFields.push(dbCol)
          oldValues[dbCol] = oldVal
          newValues[dbCol] = bodyVal
        }
      }

      if (itemsChanged) {
        changedFields.push('line_items')
        oldValues['total_amount'] = currentQuote.total_amount
        newValues['total_amount'] = updateData.total_amount
      }

      if (changedFields.length > 0) {
        // Isolated: audit failure must never break the quote save response
        try {
          await supabaseAdmin.from('quote_audit_log').insert({
            quote_id: params.id,
            username,
            display_name: displayName,
            changed_fields: changedFields,
            old_values: oldValues,
            new_values: newValues,
          })
        } catch (auditErr) {
          console.error('Audit log insert failed (non-fatal):', auditErr)
        }
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
  } catch {
    return NextResponse.json({ error: 'Failed to delete quote' }, { status: 500 })
  }
}
