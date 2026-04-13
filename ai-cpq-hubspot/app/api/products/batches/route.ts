import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('upload_batches').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return NextResponse.json({ batches: data || [] })
  } catch {
    return NextResponse.json({ batches: [] })
  }
}
