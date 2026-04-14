import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { SessionData, sessionOptions } from '@/lib/session'
import { supabaseAdmin } from '@/lib/db'
import { FOUNDATION_TIERS, ADDON_CATALOG, NONAVC_CATALOG } from '@/lib/g2-catalog'

export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const res = new NextResponse()
    const session = await getIronSession<SessionData>(request, res, sessionOptions)
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role && session.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx')
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    const allSkuIds = new Set([
      ...FOUNDATION_TIERS.map(t => t.id),
      ...ADDON_CATALOG.map(a => a.id),
      ...NONAVC_CATALOG.map(n => n.id),
    ])

    const typeMap: Record<string, string> = {}
    FOUNDATION_TIERS.forEach(t => { typeMap[t.id] = 'foundation' })
    ADDON_CATALOG.forEach(a => { typeMap[a.id] = 'addon' })
    NONAVC_CATALOG.forEach(n => { typeMap[n.id] = 'nonavc' })

    let updated = 0
    const errors: string[] = []

    for (const row of rows) {
      const skuId = (row.sku_id || row.id || '').trim().toLowerCase()
      if (!skuId) continue
      if (!allSkuIds.has(skuId)) { errors.push(`Unknown SKU: ${skuId}`); continue }

      const enabled = String(row.enabled ?? 'true').toLowerCase() !== 'false'

      // Check for existing
      const { data: existing } = await supabaseAdmin
        .from('g2_sku_overrides')
        .select('id')
        .eq('sku_id', skuId)
        .single()

      if (existing) {
        await supabaseAdmin
          .from('g2_sku_overrides')
          .update({ enabled, updated_at: new Date().toISOString() })
          .eq('sku_id', skuId)
      } else {
        await supabaseAdmin
          .from('g2_sku_overrides')
          .insert({ sku_id: skuId, sku_type: typeMap[skuId], enabled })
      }
      updated++
    }

    return NextResponse.json({ updated, errors })
  } catch (err) {
    console.error('G2 SKU upload:', err)
    return NextResponse.json({ error: 'Failed to process upload' }, { status: 500 })
  }
}
