import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { name, team, type, condition, active } = body

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (name !== undefined) updates.name = name
    if (team !== undefined) updates.team = team
    if (type !== undefined) updates.type = type
    if (condition !== undefined) updates.condition = condition
    if (active !== undefined) updates.active = active

    const { data, error } = await supabaseAdmin
      .from('rules')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ rule: data })
  } catch (err) {
    console.error('Rules PUT:', err)
    return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error } = await supabaseAdmin.from('rules').delete().eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Rules DELETE:', err)
    return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 })
  }
}
