import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data: entries, error } = await supabaseAdmin
      .from('quote_audit_log')
      .select('*')
      .eq('quote_id', params.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ entries: entries || [] })
  } catch {
    return NextResponse.json({ entries: [] })
  }
}
