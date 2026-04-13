import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'

export async function GET() {
  const { data } = await supabaseAdmin
    .from('upload_batches')
    .select('id, filename, created_at')
    .order('created_at', { ascending: false })

  return NextResponse.json({ batches: data || [] })
}
