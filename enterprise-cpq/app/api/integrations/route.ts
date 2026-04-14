import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('integrations')
      .select('id, name, type, config, created_at, updated_at')
      .order('type')

    if (error) throw error
    return NextResponse.json({ integrations: data || [] })
  } catch (err) {
    console.error('Integrations GET:', err)
    return NextResponse.json({ integrations: [] })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, name, config } = body

    if (!type) return NextResponse.json({ error: 'type is required' }, { status: 400 })

    const { data: existing } = await supabaseAdmin
      .from('integrations')
      .select('id')
      .eq('type', type)
      .single()

    if (existing) {
      const { data, error } = await supabaseAdmin
        .from('integrations')
        .update({ name: name || type, config, updated_at: new Date().toISOString() })
        .eq('type', type)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ integration: data })
    }

    const { data, error } = await supabaseAdmin
      .from('integrations')
      .insert({ type, name: name || type, config })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ integration: data })
  } catch (err) {
    console.error('Integrations PUT:', err)
    return NextResponse.json({ error: 'Failed to save integration' }, { status: 500 })
  }
}
