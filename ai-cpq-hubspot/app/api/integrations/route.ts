import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('integrations').select('id, type, is_active, updated_at')
    if (error) throw error
    // Return config keys without secrets
    return NextResponse.json({ integrations: data || [] })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch integrations' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { type, config, isActive } = await request.json()
    if (!type) return NextResponse.json({ error: 'type is required' }, { status: 400 })

    const { data: existing } = await supabaseAdmin
      .from('integrations').select('id').eq('type', type).single()

    let result
    if (existing) {
      const { data, error } = await supabaseAdmin
        .from('integrations')
        .update({ config, is_active: isActive ?? true, updated_at: new Date().toISOString() })
        .eq('type', type).select().single()
      if (error) throw error
      result = data
    } else {
      const { data, error } = await supabaseAdmin
        .from('integrations')
        .insert({ type, config, is_active: isActive ?? true })
        .select().single()
      if (error) throw error
      result = data
    }
    return NextResponse.json({ integration: result })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to save integration' }, { status: 500 })
  }
}
