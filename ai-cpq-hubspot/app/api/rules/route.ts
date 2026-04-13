import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('rules')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ rules: [] })
  return NextResponse.json({ rules: data || [] })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { name, team, type, condition, active } = body

  if (!name || !team || !type) {
    return NextResponse.json({ error: 'name, team and type are required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('rules')
    .insert({ name, team, type, condition: condition || {}, active: active !== false })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ rule: data })
}
