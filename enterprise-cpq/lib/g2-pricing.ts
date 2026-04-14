// G2 Pricing Calculation Helpers
// Used by the proposal builder, rate card builder, and PPTX export.

import {
  FOUNDATION_TIERS,
  ADDON_CATALOG,
  NONAVC_CATALOG,
  ProposalProduct,
  ProposalSnapshot,
  RateCardData,
} from './g2-catalog'

/** Returns the base package list price (or rate card override if provided). */
export function getBasePrice(tierId: string, rateCard?: RateCardData | null): number {
  const tier = FOUNDATION_TIERS.find(t => t.id === tierId)
  if (!tier) return 0
  const override = rateCard?.basePkgs?.[tierId]?.price
  return override != null ? override : tier.listPrice
}

/** Returns the price for a specific add-on tier (or rate card override). */
export function getAddonTierPrice(
  addonId: string,
  tierIdx: number,
  rateCard?: RateCardData | null,
): number {
  const addon = ADDON_CATALOG.find(a => a.id === addonId)
  if (!addon || tierIdx < 0 || tierIdx >= addon.tiers.length) return 0
  const rcTiers = rateCard?.addons?.[addonId]?.tiers
  if (rcTiers && rcTiers[tierIdx] != null) {
    return rcTiers[tierIdx].myPrice
  }
  return addon.tiers[tierIdx].price
}

/** Applies a discount percentage to a price. */
export function applyDiscount(price: number, discPct: number): number {
  if (discPct <= 0) return price
  return price * (1 - discPct / 100)
}

/** Formats a number as a USD dollar string. */
export function fmtUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })
}

interface LineItem {
  label: string
  qty: number
  listPrice: number
  discPct: number
  netPrice: number
  totalNet: number
}

/** Computes the fully-expanded line items for one product. */
export function calcProductLineItems(
  product: ProposalProduct,
  rateCard?: RateCardData | null,
  proposalDiscPct = 0,
): LineItem[] {
  const items: LineItem[] = []

  // Base package
  const tier = FOUNDATION_TIERS.find(t => t.id === product.basePkg)
  if (tier) {
    const listPrice = getBasePrice(product.basePkg, rateCard)
    const customRate = product.baseRate ? parseFloat(product.baseRate) : null
    const effectiveList = customRate != null && !isNaN(customRate) ? customRate : listPrice
    const discPct = (parseFloat(product.baseDisc) || 0) + proposalDiscPct
    const netPrice = applyDiscount(effectiveList, discPct)
    items.push({
      label: `${tier.name} Package`,
      qty: 1,
      listPrice: effectiveList,
      discPct,
      netPrice,
      totalNet: netPrice,
    })
  }

  // Add-ons
  for (const [addonId, state] of Object.entries(product.addons)) {
    if (!state.on) continue
    const addon = ADDON_CATALOG.find(a => a.id === addonId)
    if (!addon) continue

    const listPrice = getAddonTierPrice(addonId, state.tierIdx, rateCard)
    const customRate = state.rate ? parseFloat(state.rate) : null
    const effectiveList = customRate != null && !isNaN(customRate) ? customRate : listPrice
    const discPct = addon.noDisc ? 0 : (parseFloat(state.disc) || 0) + proposalDiscPct
    const netPrice = applyDiscount(effectiveList, discPct)
    const qty = state.qty > 0 ? state.qty : 1

    const tierLabel = addon.tiers[state.tierIdx]?.label ?? `Tier ${state.tierIdx + 1}`
    items.push({
      label: `${addon.name} — ${tierLabel}`,
      qty,
      listPrice: effectiveList,
      discPct,
      netPrice,
      totalNet: netPrice * qty,
    })
  }

  return items
}

/** Returns the total ACV for one product. */
export function calcProductTotal(
  product: ProposalProduct,
  rateCard?: RateCardData | null,
  proposalDiscPct = 0,
): number {
  return calcProductLineItems(product, rateCard, proposalDiscPct).reduce(
    (sum, li) => sum + li.totalNet,
    0,
  )
}

/** Returns the grand total for the full proposal snapshot (ACV + non-ACV). */
export function calcGrandTotal(
  snapshot: ProposalSnapshot,
  rateCard?: RateCardData | null,
): number {
  const propDisc = parseFloat(snapshot.proposalDisc) || 0

  const acvTotal = snapshot.products.reduce(
    (sum, p) => sum + calcProductTotal(p, rateCard, propDisc),
    0,
  )

  let nonAcvTotal = 0
  for (const [itemId, state] of Object.entries(snapshot.acctItems)) {
    if (!state.qty) continue
    const nonAvc = NONAVC_CATALOG.find(n => n.id === itemId)
    if (!nonAvc) continue
    const customRate = state.rate ? parseFloat(state.rate) : null
    const effectivePrice = customRate != null && !isNaN(customRate)
      ? customRate
      : (rateCard?.nonAcv?.[itemId]?.price ?? nonAvc.listPrice)
    nonAcvTotal += effectivePrice * state.qty
  }

  return acvTotal + nonAcvTotal
}

export interface MultiYearRow {
  label: string
  annualAcv: number
  totalValue: number
}

/** Builds a multi-year table for contract term display. */
export function buildMultiYearTable(annualAcv: number, contractTerm: string): MultiYearRow[] {
  const months = parseInt(contractTerm) || 12
  const years = Math.max(1, Math.round(months / 12))
  const rows: MultiYearRow[] = []
  for (let y = 1; y <= Math.max(years, 3); y++) {
    rows.push({
      label: `Year ${y}`,
      annualAcv,
      totalValue: annualAcv * y,
    })
  }
  return rows
}

/** Returns a flat list of all line items across all products (for PPTX pricing table). */
export function calcAllLineItems(
  snapshot: ProposalSnapshot,
  rateCard?: RateCardData | null,
): { productName: string; items: LineItem[] }[] {
  const propDisc = parseFloat(snapshot.proposalDisc) || 0
  return snapshot.products.map(p => ({
    productName: p.name,
    items: calcProductLineItems(p, rateCard, propDisc),
  }))
}
