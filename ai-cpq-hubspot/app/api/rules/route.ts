import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('rules')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) throw error
    return NextResponse.json({ rules: data || [] })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch rules' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, team, ruleType, conditions } = body
    if (!title || !team || !ruleType) {
      return NextResponse.json({ error: 'title, team, and ruleType are required' }, { status: 400 })
    }
    const { data, error } = await supabaseAdmin
      .from('rules')
      .insert({ title, description, team, rule_type: ruleType, conditions: conditions || {}, is_active: true })
      .select().single()
    if (error) throw error
    return NextResponse.json({ rule: data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 })
  }
}
