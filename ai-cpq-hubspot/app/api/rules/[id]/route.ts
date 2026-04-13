import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { title, description, team, ruleType, conditions, isActive } = body
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (title !== undefined) updates.title = title
    if (description !== undefined) updates.description = description
    if (team !== undefined) updates.team = team
    if (ruleType !== undefined) updates.rule_type = ruleType
    if (conditions !== undefined) updates.conditions = conditions
    if (isActive !== undefined) updates.is_active = isActive

    const { data, error } = await supabaseAdmin
      .from('rules').update(updates).eq('id', params.id).select().single()
    if (error) throw error
    return NextResponse.json({ rule: data })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error } = await supabaseAdmin.from('rules').delete().eq('id', params.id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 })
  }
}
