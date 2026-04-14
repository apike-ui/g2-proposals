import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { SessionData, sessionOptions } from '@/lib/session'
import { supabaseAdmin } from '@/lib/db'
import { FOUNDATION_TIERS, ADDON_CATALOG, NONAVC_CATALOG } from '@/lib/g2-catalog'

export async function GET(request: NextRequest) {
  try {
    const res = new NextResponse()
    const session = await getIronSession<SessionData>(request, res, sessionOptions)
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: overrides } = await supabaseAdmin
      .from('g2_sku_overrides')
      .select('*')

    const overrideMap: Record<string, { enabled: boolean; custom_data: unknown }> = {}
    for (const o of overrides || []) {
      overrideMap[o.sku_id as string] = { enabled: o.enabled as boolean, custom_data: o.custom_data }
    }

    const foundation = FOUNDATION_TIERS.map(t => ({
      ...t,
      sku_type: 'foundation' as const,
      enabled: overrideMap[t.id]?.enabled ?? true,
      custom_data: overrideMap[t.id]?.custom_data ?? {},
    }))

    const addons = ADDON_CATALOG.map(a => ({
      ...a,
      sku_type: 'addon' as const,
      enabled: overrideMap[a.id]?.enabled ?? true,
      custom_data: overrideMap[a.id]?.custom_data ?? {},
    }))

    const nonavc = NONAVC_CATALOG.map(n => ({
      ...n,
      sku_type: 'nonavc' as const,
      enabled: overrideMap[n.id]?.enabled ?? true,
      custom_data: overrideMap[n.id]?.custom_data ?? {},
    }))

    return NextResponse.json({ foundation, addons, nonavc })
  } catch (err) {
    console.error('G2 SKUs GET:', err)
    return NextResponse.json({ error: 'Failed to fetch SKUs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const res = new NextResponse()
    const session = await getIronSession<SessionData>(request, res, sessionOptions)
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role && session.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { sku_id, sku_type, enabled, custom_data } = body

    if (!sku_id || !sku_type) {
      return NextResponse.json({ error: 'sku_id and sku_type are required' }, { status: 400 })
    }

    // Upsert (insert or update on conflict)
    const { data: existing } = await supabaseAdmin
      .from('g2_sku_overrides')
      .select('id')
      .eq('sku_id', sku_id)
      .single()

    if (existing) {
      const { error } = await supabaseAdmin
        .from('g2_sku_overrides')
        .update({ enabled, custom_data: custom_data || {}, updated_at: new Date().toISOString() })
        .eq('sku_id', sku_id)
      if (error) throw error
    } else {
      const { error } = await supabaseAdmin
        .from('g2_sku_overrides')
        .insert({ sku_id, sku_type, enabled: enabled ?? true, custom_data: custom_data || {} })
      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('G2 SKU POST:', err)
    return NextResponse.json({ error: 'Failed to update SKU' }, { status: 500 })
  }
}
