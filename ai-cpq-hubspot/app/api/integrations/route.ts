import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('integrations')
    .select('id, name, type, config, created_at, updated_at')
    .order('type')

  if (error) return NextResponse.json({ integrations: [] })
  return NextResponse.json({ integrations: data || [] })
}

export async function PUT(request: NextRequest) {
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
}
