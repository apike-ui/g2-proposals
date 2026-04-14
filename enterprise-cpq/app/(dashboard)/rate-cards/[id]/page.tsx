'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  FOUNDATION_TIERS,
  ADDON_CATALOG,
  NONAVC_CATALOG,
  RateCardData,
  RateCardTierOverride,
  RateCardVolumeDisc,
} from '@/lib/g2-catalog'
import { fmtUSD } from '@/lib/g2-pricing'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface RateCardMeta {
  id: string
  name: string
  customer: string
  owner: string
  proposalCount: number
}

// ─── helpers ───────────────────────────────────────────────────────────────────

function buildEmptyCardData(): RateCardData {
  const basePkgs: RateCardData['basePkgs'] = {}
  FOUNDATION_TIERS.forEach(t => {
    basePkgs[t.id] = { price: t.listPrice }
  })

  const addons: RateCardData['addons'] = {}
  ADDON_CATALOG.forEach(a => {
    addons[a.id] = {
      tiers: a.tiers.map(t => ({ label: t.label, listPrice: t.price, myPrice: t.price })),
      volumeDisc: [],
    }
  })

  const nonAcv: RateCardData['nonAcv'] = {}
  NONAVC_CATALOG.forEach(n => {
    nonAcv[n.id] = { price: n.listPrice }
  })

  return { basePkgs, addons, nonAcv }
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function RateCardBuilderPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [meta, setMeta] = useState<RateCardMeta>({
    id: '',
    name: 'Untitled Rate Card',
    customer: '',
    owner: '',
    proposalCount: 0,
  })
  const [cardData, setCardData] = useState<RateCardData>(buildEmptyCardData())
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [activeAddon, setActiveAddon] = useState<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const [rcRes, meRes] = await Promise.all([
          fetch(`/api/rate-cards/${id}`),
          fetch('/api/auth/me'),
        ])
        const [rcData, meData] = await Promise.all([rcRes.json(), meRes.json()])

        if (rcData.rateCard) {
          setMeta({
            id: rcData.rateCard.id,
            name: rcData.rateCard.name,
            customer: rcData.rateCard.customer || '',
            owner: rcData.rateCard.owner || '',
            proposalCount: rcData.proposalCount ?? 0,
          })

          // Merge saved card_data with empty defaults (handles newly added SKUs)
          const saved: Partial<RateCardData> = rcData.rateCard.card_data || {}
          const empty = buildEmptyCardData()

          // Merge basePkgs
          const mergedBase = { ...empty.basePkgs }
          if (saved.basePkgs) {
            Object.entries(saved.basePkgs).forEach(([k, v]) => {
              if (mergedBase[k]) mergedBase[k] = v
            })
          }

          // Merge addons — preserve saved tier overrides and volume discounts
          const mergedAddons = { ...empty.addons }
          if (saved.addons) {
            Object.entries(saved.addons).forEach(([k, v]) => {
              if (mergedAddons[k]) {
                // Merge tiers (preserve saved myPrice values)
                const mergedTiers = mergedAddons[k].tiers.map((t, i) => {
                  const savedTier = v.tiers?.[i]
                  return savedTier ? { ...t, myPrice: savedTier.myPrice } : t
                })
                mergedAddons[k] = {
                  tiers: mergedTiers,
                  volumeDisc: v.volumeDisc || [],
                }
              }
            })
          }

          // Merge nonAcv
          const mergedNonAcv = { ...empty.nonAcv }
          if (saved.nonAcv) {
            Object.entries(saved.nonAcv).forEach(([k, v]) => {
              if (mergedNonAcv[k]) mergedNonAcv[k] = v
            })
          }

          setCardData({ basePkgs: mergedBase, addons: mergedAddons, nonAcv: mergedNonAcv })
        }

        setIsAdmin(!meData?.role || meData.role === 'admin')
      } catch {
        // leave as defaults
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  // ─── auto-save ───────────────────────────────────────────────────────────────

  const autoSave = useCallback(
    async (updatedMeta: RateCardMeta, updatedCard: RateCardData) => {
      if (!isAdmin) return
      setSaveStatus('saving')
      try {
        const res = await fetch(`/api/rate-cards/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: updatedMeta.name,
            customer: updatedMeta.customer,
            owner: updatedMeta.owner,
            card_data: updatedCard,
          }),
        })
        if (res.ok) {
          setSaveStatus('saved')
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
          saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000)
        } else {
          setSaveStatus('error')
        }
      } catch {
        setSaveStatus('error')
      }
    },
    [id, isAdmin],
  )

  function triggerSave(newMeta?: RateCardMeta, newCard?: RateCardData) {
    autoSave(newMeta ?? meta, newCard ?? cardData)
  }

  // ─── meta updates ────────────────────────────────────────────────────────────

  function updateMeta(field: keyof RateCardMeta, value: string) {
    const updated = { ...meta, [field]: value }
    setMeta(updated)
    triggerSave(updated, cardData)
  }

  // ─── base pkg updates ────────────────────────────────────────────────────────

  function updateBasePrice(tierId: string, rawVal: string) {
    const price = parseFloat(rawVal)
    const updated: RateCardData = {
      ...cardData,
      basePkgs: {
        ...cardData.basePkgs,
        [tierId]: { price: isNaN(price) ? 0 : price },
      },
    }
    setCardData(updated)
    triggerSave(meta, updated)
  }

  // ─── addon tier updates ───────────────────────────────────────────────────────

  function updateAddonTierPrice(addonId: string, tierIdx: number, rawVal: string) {
    const price = parseFloat(rawVal)
    const addonData = cardData.addons[addonId]
    if (!addonData) return
    const newTiers = [...addonData.tiers]
    newTiers[tierIdx] = { ...newTiers[tierIdx], myPrice: isNaN(price) ? 0 : price }
    const updated: RateCardData = {
      ...cardData,
      addons: {
        ...cardData.addons,
        [addonId]: { ...addonData, tiers: newTiers },
      },
    }
    setCardData(updated)
    triggerSave(meta, updated)
  }

  // ─── volume discount updates ─────────────────────────────────────────────────

  function addVolumeDisc(addonId: string) {
    const addonData = cardData.addons[addonId]
    if (!addonData) return
    const updated: RateCardData = {
      ...cardData,
      addons: {
        ...cardData.addons,
        [addonId]: {
          ...addonData,
          volumeDisc: [...addonData.volumeDisc, { minProducts: 2, discPct: 5 }],
        },
      },
    }
    setCardData(updated)
    triggerSave(meta, updated)
  }

  function updateVolumeDisc(addonId: string, idx: number, field: keyof RateCardVolumeDisc, rawVal: string) {
    const addonData = cardData.addons[addonId]
    if (!addonData) return
    const val = parseFloat(rawVal)
    const newDiscs = [...addonData.volumeDisc]
    newDiscs[idx] = { ...newDiscs[idx], [field]: isNaN(val) ? 0 : val }
    const updated: RateCardData = {
      ...cardData,
      addons: {
        ...cardData.addons,
        [addonId]: { ...addonData, volumeDisc: newDiscs },
      },
    }
    setCardData(updated)
    triggerSave(meta, updated)
  }

  function removeVolumeDisc(addonId: string, idx: number) {
    const addonData = cardData.addons[addonId]
    if (!addonData) return
    const updated: RateCardData = {
      ...cardData,
      addons: {
        ...cardData.addons,
        [addonId]: {
          ...addonData,
          volumeDisc: addonData.volumeDisc.filter((_, i) => i !== idx),
        },
      },
    }
    setCardData(updated)
    triggerSave(meta, updated)
  }

  // ─── non-ACV updates ─────────────────────────────────────────────────────────

  function updateNonAcvPrice(itemId: string, rawVal: string) {
    const price = parseFloat(rawVal)
    const updated: RateCardData = {
      ...cardData,
      nonAcv: {
        ...cardData.nonAcv,
        [itemId]: { price: isNaN(price) ? 0 : price },
      },
    }
    setCardData(updated)
    triggerSave(meta, updated)
  }

  // ─── render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="p-6 text-center text-gray-400 py-16">Loading...</div>
  }

  const readOnly = !isAdmin

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/proposals" className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        <div className="flex-1">
          {readOnly ? (
            <h1 className="text-xl font-bold text-gray-900">{meta.name}</h1>
          ) : (
            <input
              type="text"
              value={meta.name}
              onChange={e => setMeta({ ...meta, name: e.target.value })}
              onBlur={e => updateMeta('name', e.target.value)}
              className="text-xl font-bold text-gray-900 bg-transparent border-0 border-b-2 border-transparent hover:border-gray-200 focus:border-red-400 outline-none w-full max-w-lg transition-colors"
              style={{ '--tw-ring-color': 'transparent' } as React.CSSProperties}
            />
          )}
        </div>

        <div className="flex items-center gap-3">
          {meta.proposalCount > 0 && (
            <span className="text-xs text-gray-400">
              Applied to {meta.proposalCount} proposal{meta.proposalCount !== 1 ? 's' : ''}
            </span>
          )}
          {saveStatus === 'saving' && (
            <span className="text-xs text-gray-400">Saving…</span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-xs text-green-600 font-medium">Saved</span>
          )}
          {saveStatus === 'error' && (
            <span className="text-xs text-red-500">Save failed</span>
          )}
          {readOnly && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">View Only</span>
          )}
        </div>
      </div>

      {/* Meta Fields */}
      <div className="card p-5 mb-6">
        <h2 className="font-semibold text-gray-700 mb-4">Rate Card Details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Customer</label>
            {readOnly ? (
              <p className="text-gray-900">{meta.customer || '—'}</p>
            ) : (
              <input
                type="text"
                value={meta.customer}
                onChange={e => setMeta({ ...meta, customer: e.target.value })}
                onBlur={e => updateMeta('customer', e.target.value)}
                placeholder="Customer name"
                className="input w-full"
              />
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Owner</label>
            {readOnly ? (
              <p className="text-gray-900">{meta.owner || '—'}</p>
            ) : (
              <input
                type="text"
                value={meta.owner}
                onChange={e => setMeta({ ...meta, owner: e.target.value })}
                onBlur={e => updateMeta('owner', e.target.value)}
                placeholder="Owner / AE name"
                className="input w-full"
              />
            )}
          </div>
        </div>
      </div>

      {/* Base Package Pricing */}
      <div className="card overflow-hidden mb-6">
        <div className="card-header">
          <h2 className="font-semibold text-gray-900">Base Package Pricing</h2>
          <p className="text-xs text-gray-400">Override the list price for each foundation tier</p>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="table-header">Package</th>
              <th className="table-header text-right">List Price</th>
              <th className="table-header text-right">My Price</th>
              {!readOnly && <th className="table-header text-right">Discount</th>}
            </tr>
          </thead>
          <tbody>
            {FOUNDATION_TIERS.map(tier => {
              const myPrice = cardData.basePkgs[tier.id]?.price ?? tier.listPrice
              const disc = tier.listPrice > 0
                ? (((tier.listPrice - myPrice) / tier.listPrice) * 100).toFixed(1)
                : '—'
              return (
                <tr key={tier.id} className="table-row">
                  <td className="table-cell">
                    <span className="font-medium text-gray-900">{tier.name}</span>
                  </td>
                  <td className="table-cell text-right text-gray-400 text-sm">
                    {tier.listPrice > 0 ? fmtUSD(tier.listPrice) : 'Free'}
                  </td>
                  <td className="table-cell text-right">
                    {readOnly ? (
                      <span className="font-medium text-gray-900">
                        {myPrice > 0 ? fmtUSD(myPrice) : 'Free'}
                      </span>
                    ) : (
                      <input
                        type="number"
                        value={myPrice}
                        onChange={e => updateBasePrice(tier.id, e.target.value)}
                        onBlur={e => updateBasePrice(tier.id, e.target.value)}
                        className="input text-right w-32 ml-auto"
                        min={0}
                        step={500}
                        disabled={tier.listPrice === 0}
                      />
                    )}
                  </td>
                  {!readOnly && (
                    <td className="table-cell text-right text-sm">
                      {tier.listPrice > 0 && myPrice < tier.listPrice ? (
                        <span className="text-green-600 font-medium">{disc}% off</span>
                      ) : tier.listPrice > 0 && myPrice > tier.listPrice ? (
                        <span className="text-orange-500 font-medium">+{Math.abs(parseFloat(disc))}%</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Add-On Pricing */}
      <div className="card overflow-hidden mb-6">
        <div className="card-header">
          <h2 className="font-semibold text-gray-900">Add-On Pricing</h2>
          <p className="text-xs text-gray-400">Set customer-specific pricing for each add-on and tier</p>
        </div>

        {/* Addon selector tabs */}
        <div className="border-b border-gray-100 bg-gray-50 px-4 pt-2 flex gap-1 flex-wrap">
          {ADDON_CATALOG.map(addon => (
            <button
              key={addon.id}
              onClick={() => setActiveAddon(activeAddon === addon.id ? null : addon.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-t border-b-2 -mb-px transition-colors ${
                activeAddon === addon.id
                  ? 'bg-white border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              style={activeAddon === addon.id ? { borderColor: '#FF492C', color: '#FF492C' } : {}}
            >
              {addon.name}
            </button>
          ))}
        </div>

        {activeAddon === null ? (
          <div className="p-6 text-center text-gray-400 text-sm">
            Select an add-on above to configure pricing
          </div>
        ) : (() => {
          const addon = ADDON_CATALOG.find(a => a.id === activeAddon)!
          const addonData = cardData.addons[activeAddon]
          if (!addon || !addonData) return null

          return (
            <div className="p-5">
              {/* Tier pricing table */}
              <table className="w-full mb-4">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="table-header">Tier</th>
                    <th className="table-header text-right">List Price</th>
                    <th className="table-header text-right">My Price</th>
                    {!readOnly && <th className="table-header text-right">Discount</th>}
                  </tr>
                </thead>
                <tbody>
                  {addonData.tiers.map((tier: RateCardTierOverride, tierIdx: number) => {
                    const disc = tier.listPrice > 0
                      ? (((tier.listPrice - tier.myPrice) / tier.listPrice) * 100).toFixed(1)
                      : '—'
                    return (
                      <tr key={tierIdx} className="table-row">
                        <td className="table-cell text-gray-700">{tier.label}</td>
                        <td className="table-cell text-right text-gray-400 text-sm">
                          {tier.listPrice > 0 ? fmtUSD(tier.listPrice) : 'Custom'}
                        </td>
                        <td className="table-cell text-right">
                          {readOnly ? (
                            <span className="font-medium text-gray-900">
                              {tier.myPrice > 0 ? fmtUSD(tier.myPrice) : '—'}
                            </span>
                          ) : (
                            <input
                              type="number"
                              value={tier.myPrice}
                              onChange={e => updateAddonTierPrice(activeAddon, tierIdx, e.target.value)}
                              onBlur={e => updateAddonTierPrice(activeAddon, tierIdx, e.target.value)}
                              className="input text-right w-36 ml-auto"
                              min={0}
                              step={500}
                            />
                          )}
                        </td>
                        {!readOnly && (
                          <td className="table-cell text-right text-sm">
                            {tier.listPrice > 0 && tier.myPrice < tier.listPrice ? (
                              <span className="text-green-600 font-medium">{disc}% off</span>
                            ) : tier.listPrice > 0 && tier.myPrice > tier.listPrice ? (
                              <span className="text-orange-500 font-medium">
                                +{Math.abs(parseFloat(disc))}%
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Category pricing info (read-only) */}
              {addon.catPricing && (
                <div className="mb-4 p-3 bg-blue-50 rounded text-xs text-blue-700">
                  <strong>Category pricing available:</strong> All-categories flat rate:{' '}
                  {fmtUSD(addon.allCatPrice ?? 0)}. Volume tiers:{' '}
                  {addon.catVolume?.map(r => `${r.minCats}+ cats @ ${fmtUSD(r.perCatPrice)}/cat`).join(', ')}
                </div>
              )}

              {/* Volume Discounts */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-700">Volume Discount Rules</h4>
                  {!readOnly && (
                    <button
                      onClick={() => addVolumeDisc(activeAddon)}
                      className="btn-secondary btn-sm text-xs"
                    >
                      + Add Rule
                    </button>
                  )}
                </div>

                {addonData.volumeDisc.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    {readOnly ? 'No volume discount rules.' : 'No rules yet. Add rules to apply automatic discounts based on quantity.'}
                  </p>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="table-header">Min Products</th>
                        <th className="table-header">Discount %</th>
                        {!readOnly && <th className="table-header" />}
                      </tr>
                    </thead>
                    <tbody>
                      {addonData.volumeDisc.map((rule: RateCardVolumeDisc, idx: number) => (
                        <tr key={idx} className="table-row">
                          <td className="table-cell">
                            {readOnly ? (
                              <span>{rule.minProducts}+ products</span>
                            ) : (
                              <input
                                type="number"
                                value={rule.minProducts}
                                onChange={e => updateVolumeDisc(activeAddon, idx, 'minProducts', e.target.value)}
                                className="input w-28"
                                min={1}
                              />
                            )}
                          </td>
                          <td className="table-cell">
                            {readOnly ? (
                              <span>{rule.discPct}%</span>
                            ) : (
                              <input
                                type="number"
                                value={rule.discPct}
                                onChange={e => updateVolumeDisc(activeAddon, idx, 'discPct', e.target.value)}
                                className="input w-24"
                                min={0}
                                max={100}
                                step={0.5}
                              />
                            )}
                          </td>
                          {!readOnly && (
                            <td className="table-cell">
                              <button
                                onClick={() => removeVolumeDisc(activeAddon, idx)}
                                className="text-gray-400 hover:text-red-500 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Non-ACV Items */}
      <div className="card overflow-hidden mb-6">
        <div className="card-header">
          <h2 className="font-semibold text-gray-900">Non-ACV Item Pricing</h2>
          <p className="text-xs text-gray-400">Set customer-specific pricing for account-level items</p>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="table-header">Item</th>
              <th className="table-header">Note</th>
              <th className="table-header text-right">List Price</th>
              <th className="table-header text-right">My Price</th>
            </tr>
          </thead>
          <tbody>
            {NONAVC_CATALOG.map(item => {
              const myPrice = cardData.nonAcv[item.id]?.price ?? item.listPrice
              return (
                <tr key={item.id} className="table-row">
                  <td className="table-cell">
                    <span className="font-medium text-gray-900">{item.name}</span>
                  </td>
                  <td className="table-cell text-xs text-gray-400">{item.note}</td>
                  <td className="table-cell text-right text-gray-400 text-sm">
                    {item.listPrice > 0 ? fmtUSD(item.listPrice) : 'Variable'}
                  </td>
                  <td className="table-cell text-right">
                    {readOnly ? (
                      <span className="font-medium text-gray-900">
                        {myPrice > 0 ? fmtUSD(myPrice) : 'Variable'}
                      </span>
                    ) : (
                      <input
                        type="number"
                        value={myPrice}
                        onChange={e => updateNonAcvPrice(item.id, e.target.value)}
                        onBlur={e => updateNonAcvPrice(item.id, e.target.value)}
                        className="input text-right w-32 ml-auto"
                        min={0}
                        step={100}
                      />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Delete (admin only) */}
      {isAdmin && (
        <div className="flex justify-end">
          <button
            onClick={async () => {
              if (!confirm('Delete this rate card? This cannot be undone.')) return
              await fetch(`/api/rate-cards/${id}`, { method: 'DELETE' })
              router.push('/proposals')
            }}
            className="text-sm text-gray-400 hover:text-red-500 transition-colors"
          >
            Delete rate card
          </button>
        </div>
      )}
    </div>
  )
}
