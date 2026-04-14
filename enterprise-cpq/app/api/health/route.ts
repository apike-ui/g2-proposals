import { NextResponse } from 'next/server'

export async function GET() {
  const hasUrl = !!(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)
  const hasKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY
  const usingSupabase = hasUrl && hasKey

  let dbCheck = 'not tested'
  if (usingSupabase) {
    try {
      const { supabaseAdmin } = await import('@/lib/db')
      const { error } = await supabaseAdmin.from('rate_cards').select('id').limit(1)
      dbCheck = error ? `error: ${error.message}` : 'ok'
    } catch (e) {
      dbCheck = `exception: ${String(e)}`
    }
  }

  return NextResponse.json({
    usingSupabase,
    hasSupabaseUrl: hasUrl,
    hasServiceRoleKey: hasKey,
    dbCheck,
  })
}
