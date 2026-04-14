import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { SessionData, sessionOptions } from '@/lib/session'
import { supabaseAdmin } from '@/lib/db'
import { calcGrandTotal, calcProductLineItems, getAddonTierPrice, getBasePrice } from '@/lib/g2-pricing'
import type { ProposalSnapshot, RateCardData } from '@/lib/g2-catalog'
import { FOUNDATION_TIERS, ADDON_CATALOG } from '@/lib/g2-catalog'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const res = new NextResponse()
    const session = await getIronSession<SessionData>(request, res, sessionOptions)
    if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Load proposal + latest version
    const { data: proposal, error: pErr } = await supabaseAdmin
      .from('g2_proposals')
      .select('*')
      .eq('id', params.id)
      .single()

    if (pErr || !proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })

    const { data: versions } = await supabaseAdmin
      .from('proposal_versions')
      .select('*')
      .eq('proposal_id', params.id)
      .order('version_number', { ascending: false })

    const latestVersion = (versions || [])[0]
    if (!latestVersion) return NextResponse.json({ error: 'No saved version found. Please save the proposal first.' }, { status: 400 })

    const snapshot = latestVersion.snapshot as ProposalSnapshot
    const propRecord = proposal as Record<string, unknown>

    // Load rate card if applied
    let rateCard: RateCardData | null = null
    if (propRecord.rate_card_id) {
      const { data: rc } = await supabaseAdmin
        .from('rate_cards')
        .select('card_data')
        .eq('id', propRecord.rate_card_id)
        .single()
      if (rc) rateCard = rc.card_data as RateCardData
    }

    const propDisc = parseFloat(snapshot.proposalDisc) || 0
    const grandTotal = calcGrandTotal(snapshot, rateCard)

    // Build line_items for CPQ quotes table
    const lineItems = []
    for (const product of snapshot.products) {
      const tier = FOUNDATION_TIERS.find(t => t.id === product.basePkg)
      if (tier) {
        const listPrice = getBasePrice(product.basePkg, rateCard)
        const customRate = product.baseRate ? parseFloat(product.baseRate) : null
        const unitPrice = customRate != null && !isNaN(customRate) ? customRate : listPrice
        const discPct = (parseFloat(product.baseDisc) || 0) + propDisc
        const totalPrice = unitPrice * (1 - discPct / 100)
        lineItems.push({
          sku: `G2-${tier.id.toUpperCase()}`,
          name: `${product.name} — ${tier.name} Package`,
          quantity: 1,
          unit_price: unitPrice,
          discount_percent: discPct,
          total_price: totalPrice,
          notes: `G2 Foundation: ${tier.name}`,
        })
      }

      for (const [addonId, state] of Object.entries(product.addons)) {
        if (!state.on) continue
        const addon = ADDON_CATALOG.find(a => a.id === addonId)
        if (!addon) continue
        const listPrice = getAddonTierPrice(addonId, state.tierIdx, rateCard)
        const customRate = state.rate ? parseFloat(state.rate) : null
        const unitPrice = customRate != null && !isNaN(customRate) ? customRate : listPrice
        const discPct = addon.noDisc ? 0 : (parseFloat(state.disc) || 0) + propDisc
        const qty = state.qty > 0 ? state.qty : 1
        const totalPrice = unitPrice * qty * (1 - discPct / 100)
        const tierLabel = addon.tiers[state.tierIdx]?.label ?? `Tier ${state.tierIdx + 1}`
        lineItems.push({
          sku: `G2-ADDON-${addonId.toUpperCase()}`,
          name: `${product.name} — ${addon.name} (${tierLabel})`,
          quantity: qty,
          unit_price: unitPrice,
          discount_percent: discPct,
          total_price: totalPrice,
          notes: `G2 Add-on`,
        })
      }
    }

    // Generate quote number
    const ts = Date.now().toString().slice(-6)
    const quoteNumber = `G2Q-${ts}`

    const { data: quote, error: qErr } = await supabaseAdmin
      .from('quotes')
      .insert({
        quote_number: quoteNumber,
        customer_name: snapshot.cust || propRecord.customer,
        customer_company: snapshot.cust || propRecord.customer,
        status: 'draft',
        total_amount: grandTotal,
        rate_card_id: propRecord.rate_card_id || null,
        line_items: lineItems,
        notes: `Created from G2 Proposal: ${propRecord.name}`,
      })
      .select('id')
      .single()

    if (qErr) throw qErr
    return NextResponse.json({ quoteId: (quote as Record<string, unknown>).id })
  } catch (err) {
    console.error('Create quote from proposal:', err)
    return NextResponse.json({ error: 'Failed to create quote' }, { status: 500 })
  }
}
