'use client'

import {
  FOUNDATION_TIERS,
  ADDON_CATALOG,
  NONAVC_CATALOG,
  ProposalSnapshot,
  RateCardData,
} from '@/lib/g2-catalog'
import { calcProductLineItems, buildAddonProductCounts } from '@/lib/g2-pricing'

const C = {
  rorange: '#FF492C',
  navy: '#062846',
  green: '#27D3BC',
  blue: '#0073F5',
  purple: '#5746B2',
  mid: '#6B7280',
  light: '#F2F4F7',
}

function fmt(n: number) {
  if (!n || n === 0) return '$0'
  return '$' + Math.round(n).toLocaleString('en-US')
}

function fmtDate(d: string) {
  if (!d) return 'TBD'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface Props {
  snapshot: ProposalSnapshot
  proposalName: string
  rateCardData: RateCardData | null
  rateCardName: string | null
}

export function ProposalPreview({ snapshot, proposalName, rateCardData, rateCardName }: Props) {
  const propDiscPct = parseFloat(snapshot.proposalDisc) || 0
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  // Build addon product counts for rate-card volume discount support
  const addonCounts = buildAddonProductCounts(snapshot.products)

  // Per-product summaries
  const prodSummaries = snapshot.products.map(p => {
    const tier = FOUNDATION_TIERS.find(t => t.id === p.basePkg)

    // Line items WITHOUT proposal discount — for per-line display (but with volume discounts)
    const lineItems = calcProductLineItems(p, rateCardData, 0, addonCounts)
    const baseItem = lineItems[0] ?? null
    const addonItems = lineItems.slice(1)

    // Product ACV WITH full discount (including proposal)
    const fullLineItems = calcProductLineItems(p, rateCardData, propDiscPct, addonCounts)
    const prodAcv = fullLineItems.reduce((s, li) => s + li.totalNet, 0)
    const prodSubtotal = lineItems.reduce((s, li) => s + li.totalNet, 0)
    const prodListTotal = lineItems.reduce((s, li) => s + li.listPrice * li.qty, 0)

    const addonLines = addonItems.map(item => {
      const addon = ADDON_CATALOG.find(a => item.label.startsWith(a.name))
      return {
        name: addon?.name ?? item.label.split(' — ')[0],
        color: addon?.color ?? C.mid,
        tier: item.label.split(' — ')[1] ?? '',
        qty: item.qty,
        listRate: item.listPrice,
        listTotal: item.listPrice * item.qty,
        rate: item.netPrice,
        total: item.totalNet,
        disc: item.discPct,
      }
    })

    return {
      name: p.name,
      basePkg: tier ? { name: tier.name, color: tier.color, hl: tier.headline } : null,
      baseRate: baseItem?.netPrice ?? 0,
      listBase: baseItem?.listPrice ?? 0,
      baseDisc: parseFloat(p.baseDisc) || 0,
      addonLines,
      prodAcv,
      prodSubtotal,
      prodListTotal,
    }
  })

  const totalSubtotal = prodSummaries.reduce((s, p) => s + p.prodSubtotal, 0)
  const totalList = prodSummaries.reduce((s, p) => s + p.prodListTotal, 0)
  // ACV must equal the sum of per-product ACVs (additive discount stacking,
  // noDisc add-ons excluded) so the headline matches the SKU summary rows AND
  // the quote produced by create-quote. Deriving it as totalSubtotal*(1-disc)
  // diverges from those because it discounts noDisc items and compounds.
  const totalAcv = prodSummaries.reduce((s, p) => s + p.prodAcv, 0)
  const propDiscAmt = totalSubtotal - totalAcv

  // Non-ACV items
  const nonAcvLines = Object.entries(snapshot.acctItems)
    .filter(([, state]) => state.qty > 0)
    .map(([itemId, state]) => {
      const item = NONAVC_CATALOG.find(n => n.id === itemId)
      if (!item) return null
      const price = state.rate ? parseFloat(state.rate) : (rateCardData?.nonAcv?.[itemId]?.price ?? item.listPrice)
      return { name: item.name, qty: state.qty, total: price * state.qty }
    })
    .filter(Boolean) as { name: string; qty: number; total: number }[]

  const totalNonAcv = nonAcvLines.reduce((s, l) => s + l.total, 0)
  const grandTotal = totalAcv + totalNonAcv
  const totalSavings = totalList - totalAcv
  const savingsPct = totalList > 0 ? Math.round(totalSavings / totalList * 100) : 0
  const skuCount = prodSummaries.reduce((s, p) => s + 1 + p.addonLines.length, 0) + nonAcvLines.length

  // Contract term
  const termMonths = parseInt(snapshot.contractTerm) || 12
  const contractYears = Math.ceil(termMonths / 12)
  const termDisplay = snapshot.contractTerm && snapshot.contractTerm !== 'custom'
    ? `${snapshot.contractTerm} months`
    : 'Custom'
  const dateRange = (snapshot.startDate || snapshot.endDate)
    ? ` | ${fmtDate(snapshot.startDate)} — ${fmtDate(snapshot.endDate)}`
    : ''

  // Multi-year table rows
  const yearRows: { year: number; acv: number; nonAcv: number; total: number; cumulative: number; partial: boolean; months: number }[] = []
  if (contractYears > 1) {
    let cumulative = 0
    for (let y = 1; y <= contractYears; y++) {
      const isPartial = y === contractYears && termMonths % 12 !== 0
      const fraction = isPartial ? (termMonths % 12) / 12 : 1
      const yrAcv = Math.round(totalAcv * fraction)
      const yrNonAcv = Math.round(totalNonAcv * fraction)
      const yrTotal = yrAcv + yrNonAcv
      cumulative += yrTotal
      yearRows.push({ year: y, acv: yrAcv, nonAcv: yrNonAcv, total: yrTotal, cumulative, partial: isPartial, months: isPartial ? termMonths % 12 : 12 })
    }
  }
  const contractTotalValue = yearRows.length ? yearRows[yearRows.length - 1].cumulative : grandTotal

  const sLine: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid #F2F4F7', fontSize: 14 }

  return (
    <div>
      {/* Action bar — hidden on print */}
      <div className="no-print flex items-center justify-between mb-5 px-1">
        <div>
          <h2 className="text-lg font-bold" style={{ color: C.navy }}>Proposal Preview</h2>
          <p className="text-sm mt-0.5" style={{ color: C.mid }}>Print or save as PDF (Ctrl+P / Cmd+P).</p>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg"
          style={{ backgroundColor: C.rorange }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print / Save PDF
        </button>
      </div>

      {/* Print card */}
      <div className="proposal-preview-card bg-white rounded-xl border border-gray-200 shadow-sm" style={{ padding: '36px 40px', maxWidth: 780, margin: '0 auto' }}>

        {/* ── Document header ── */}
        <div style={{ borderTop: `4px solid ${C.rorange}`, paddingTop: 24, marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              {/* G2 wordmark */}
              <div style={{ width: 40, height: 40, background: C.rorange, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 4 }}>
                <span style={{ color: '#fff', fontWeight: 900, fontSize: 14, letterSpacing: -1 }}>G2</span>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.mid, textTransform: 'uppercase', letterSpacing: 1 }}>Proposal</div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: C.navy, marginTop: 4, lineHeight: 1.1 }}>{snapshot.cust || proposalName || 'Customer'}</h1>
                <p style={{ fontSize: 13, color: C.mid, marginTop: 4 }}>G2 FY27 Multi-Product Recommendation</p>
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
              <div style={{ fontSize: 12, color: C.mid }}>{today}</div>
              <div style={{ fontSize: 12, color: C.mid, marginTop: 2 }}>Prepared by: {snapshot.rep || 'G2 Sales'}</div>
              <div style={{ fontSize: 12, color: C.mid, marginTop: 2 }}>Term: {termDisplay}{dateRange}</div>
              {rateCardName && <div style={{ fontSize: 12, color: C.blue, fontWeight: 600, marginTop: 2 }}>Rate Card: {rateCardName}</div>}
              <div style={{ fontSize: 11, color: C.mid, marginTop: 4, fontStyle: 'italic' }}>Internal Only | Confidential</div>
            </div>
          </div>
        </div>

        {/* ── Investment Summary box ── */}
        <div style={{ borderTop: `3px solid ${C.rorange}`, background: C.light, borderRadius: 8, padding: '20px 28px', marginBottom: 28 }}>
          {/* Grand total headline */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <span style={{ fontSize: 16, fontWeight: 800, color: C.navy }}>Total Annual Investment</span>
              {contractYears > 1 && (
                <span style={{ fontSize: 12, color: C.mid, marginLeft: 8 }}>
                  ({fmt(contractTotalValue)} total contract value)
                </span>
              )}
            </div>
            <span style={{ fontSize: 28, fontWeight: 800, color: C.blue }}>{fmt(grandTotal)}/yr</span>
          </div>

          {/* 4-tile grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'ACV', value: fmt(totalAcv) },
              { label: 'Non-ACV', value: fmt(totalNonAcv) },
              { label: 'Profiles', value: String(snapshot.products.length) },
              { label: 'SKUs', value: String(skuCount) },
            ].map(tile => (
              <div key={tile.label} style={{ background: '#fff', borderRadius: 6, padding: '10px 14px', textAlign: 'center', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: C.mid, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>{tile.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.navy }}>{tile.value}</div>
              </div>
            ))}
          </div>

          {/* Savings banner */}
          {totalSavings > 0 && (
            <div style={{ background: '#E0FAF6', border: `1px solid ${C.green}`, borderRadius: 6, padding: '8px 16px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, color: C.green }}>✓</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1a6b5e' }}>Customer Savings</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontWeight: 800, fontSize: 14, color: '#1a6b5e' }}>{fmt(totalSavings)} off</span>
                {savingsPct > 0 && <span style={{ fontSize: 11, color: '#2a8a76', marginLeft: 6 }}>({savingsPct}%)</span>}
                <span style={{ fontSize: 11, color: '#2a8a76', textDecoration: 'line-through', marginLeft: 6 }}>{fmt(totalList)} list</span>
              </div>
            </div>
          )}

          {propDiscAmt > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.green, fontWeight: 600, padding: '4px 0' }}>
              <span>Proposal Discount ({propDiscPct}%)</span>
              <span>-{fmt(propDiscAmt)}</span>
            </div>
          )}

          {/* SKU Summary table */}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.mid, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>SKU Summary by Profile</div>
            <div style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1.5fr 4fr 1.5fr', background: C.navy, padding: '6px 0' }}>
                {['Profile', 'Package', 'Add-Ons', 'ACV'].map((h, hi) => (
                  <div key={h} style={{ padding: '0 10px', color: '#fff', fontWeight: 600, fontSize: 11, textAlign: hi === 3 ? 'right' : 'left' }}>{h}</div>
                ))}
              </div>
              {prodSummaries.map((ps, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2.5fr 1.5fr 4fr 1.5fr', padding: '7px 0', background: i % 2 === 0 ? '#fff' : C.light, borderTop: '1px solid #E2E8F0' }}>
                  <div style={{ padding: '0 10px', fontWeight: 700, fontSize: 12, color: C.navy, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ps.name}</div>
                  <div style={{ padding: '0 10px', fontSize: 12 }}>
                    {ps.basePkg
                      ? <span style={{ background: ps.basePkg.color, color: '#fff', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10 }}>{ps.basePkg.name}</span>
                      : <span style={{ color: C.mid }}>—</span>}
                  </div>
                  <div style={{ padding: '0 10px', display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                    {ps.addonLines.length > 0
                      ? ps.addonLines.map((a, j) => (
                          <span key={j} style={{ background: a.color + '28', color: a.color, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10, whiteSpace: 'nowrap' }}>
                            {a.name}{a.qty > 1 ? ` x${a.qty}` : ''}
                          </span>
                        ))
                      : <span style={{ fontSize: 11, color: C.mid }}>None</span>}
                  </div>
                  <div style={{ padding: '0 10px', textAlign: 'right', fontWeight: 700, fontSize: 12, color: C.navy }}>{fmt(ps.prodAcv)}</div>
                </div>
              ))}
              {nonAcvLines.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '8fr 1.5fr', padding: '7px 0', borderTop: '2px solid #E2E8F0', background: C.light }}>
                  <div style={{ padding: '0 10px', fontWeight: 600, fontSize: 11, color: C.mid }}>
                    Non-ACV: {nonAcvLines.map(l => l.name + (l.qty > 1 ? ` x${l.qty}` : '')).join(', ')}
                  </div>
                  <div style={{ padding: '0 10px', textAlign: 'right', fontWeight: 700, fontSize: 12, color: C.navy }}>{fmt(totalNonAcv)}</div>
                </div>
              )}
            </div>
          </div>

          {/* Non-ACV detail */}
          {nonAcvLines.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.mid, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Account-Level Non-ACV Items</div>
              <div style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid #E2E8F0' }}>
                {nonAcvLines.map((line, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '8fr 1.5fr', padding: '7px 10px', background: i % 2 === 0 ? '#fff' : C.light, borderTop: i > 0 ? '1px solid #E2E8F0' : 'none' }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: C.navy }}>
                      {line.name}{line.qty > 1 && <span style={{ color: C.mid, fontWeight: 400 }}> x{line.qty}</span>}
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 12, color: C.navy }}>{line.total > 0 ? fmt(line.total) : 'Variable'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cost by Year (multi-year only) */}
          {yearRows.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.mid, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Cost by Year</div>
              <div style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 2fr 2fr 2fr', background: C.navy, padding: '6px 0' }}>
                  {['Year', 'ACV', 'Non-ACV', 'Annual Total', 'Cumulative'].map((h, hi) => (
                    <div key={h} style={{ padding: '0 10px', color: '#fff', fontWeight: 600, fontSize: 11, textAlign: hi > 0 ? 'right' : 'left' }}>{h}</div>
                  ))}
                </div>
                {yearRows.map(yr => (
                  <div key={yr.year} style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 2fr 2fr 2fr', padding: '8px 0', background: yr.year % 2 === 1 ? '#fff' : C.light, borderTop: '1px solid #E2E8F0' }}>
                    <div style={{ padding: '0 10px', fontWeight: 700, fontSize: 12, color: C.navy }}>Year {yr.year}{yr.partial ? ` (${yr.months}mo)` : ''}</div>
                    <div style={{ padding: '0 10px', textAlign: 'right', fontSize: 12, color: C.navy }}>{fmt(yr.acv)}</div>
                    <div style={{ padding: '0 10px', textAlign: 'right', fontSize: 12, color: C.mid }}>{fmt(yr.nonAcv)}</div>
                    <div style={{ padding: '0 10px', textAlign: 'right', fontWeight: 700, fontSize: 12, color: C.blue }}>{fmt(yr.total)}</div>
                    <div style={{ padding: '0 10px', textAlign: 'right', fontWeight: 600, fontSize: 12, color: C.navy }}>{fmt(yr.cumulative)}</div>
                  </div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: '5.5fr 2fr 2fr', padding: '8px 0', borderTop: `2px solid ${C.navy}`, background: C.navy }}>
                  <div style={{ padding: '0 10px', fontWeight: 700, fontSize: 12, color: '#fff' }}>Total Contract Value ({contractYears} year{contractYears > 1 ? 's' : ''})</div>
                  <div style={{ padding: '0 10px', textAlign: 'right', fontWeight: 800, fontSize: 14, color: C.blue }}>{fmt(contractTotalValue)}</div>
                  <div />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Per-product detail sections ── */}
        {prodSummaries.map((ps, idx) => {
          const color = ps.basePkg?.color ?? C.mid
          return (
            <div key={idx} style={{ marginBottom: 28 }}>
              {/* Product header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{idx + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: C.navy }}>{ps.name}</div>
                  <div style={{ fontSize: 12, color: C.mid }}>Profile {idx + 1} of {prodSummaries.length}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: C.mid }}>Product ACV</div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: C.navy }}>{fmt(ps.prodAcv)}</div>
                </div>
              </div>

              {/* Base package line */}
              {ps.basePkg && (
                <div style={sLine}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 14, color: C.navy }}>{ps.basePkg.name}</span>
                    <span style={{ background: color, color: '#fff', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, marginLeft: 8 }}>Base</span>
                    <div style={{ fontSize: 12, color: C.mid, marginTop: 2 }}>{ps.basePkg.hl}</div>
                    {ps.baseDisc > 0 && <div style={{ fontSize: 11, color: C.green, fontWeight: 600, marginTop: 2 }}>{ps.baseDisc}% discount applied</div>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
                    {ps.baseDisc > 0 && <div style={{ fontSize: 11, color: '#B0BACA', textDecoration: 'line-through' }}>{fmt(ps.listBase)}/yr</div>}
                    <span style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>{fmt(ps.baseRate)}/yr</span>
                  </div>
                </div>
              )}

              {/* Add-on lines */}
              {ps.addonLines.map((line, li) => (
                <div key={li} style={sLine}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: line.color, flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, fontSize: 13, color: C.navy }}>{line.name}</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.mid, marginTop: 2, marginLeft: 14 }}>{line.tier}{line.qty > 1 ? ` x ${line.qty}` : ''}</div>
                    {line.disc > 0 && <div style={{ fontSize: 11, color: C.green, fontWeight: 600, marginTop: 2, marginLeft: 14 }}>{Math.round(line.disc)}% discount applied</div>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
                    {line.disc > 0 && (
                      <div style={{ fontSize: 11, color: '#B0BACA', textDecoration: 'line-through' }}>
                        {line.qty > 1 ? fmt(line.listTotal) : fmt(line.listRate)}
                      </div>
                    )}
                    {line.qty > 1 && <div style={{ fontSize: 11, color: C.mid }}>{fmt(line.rate)} × {line.qty}</div>}
                    <span style={{ fontWeight: 700, fontSize: 14, color: C.navy }}>{line.total > 0 ? fmt(line.total) : 'Custom'}</span>
                  </div>
                </div>
              ))}

              {/* Dashed separator */}
              {idx < prodSummaries.length - 1 && (
                <div style={{ borderBottom: '2px dashed #E2E8F0', marginTop: 16 }} />
              )}
            </div>
          )
        })}

        {/* ── Proposal discount summary lines ── */}
        {propDiscAmt > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid #E2E8F0', marginTop: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: C.navy }}>Subtotal ACV</span>
              <span style={{ fontWeight: 600, fontSize: 14, color: C.navy }}>{fmt(totalSubtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: C.green }}>Proposal Discount ({propDiscPct}%)</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: C.green }}>-{fmt(propDiscAmt)}</span>
            </div>
          </>
        )}

        {/* ── Document footer ── */}
        <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 16, height: 16, background: C.rorange, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontWeight: 900, fontSize: 9 }}>G2</span>
            </div>
            <span style={{ fontSize: 10, color: '#B0BACA' }}>g2.com | Internal Only | Confidential</span>
          </div>
          <span style={{ fontSize: 10, color: '#B0BACA' }}>Prepared {today}</span>
        </div>
      </div>
    </div>
  )
}
