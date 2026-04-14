'use client'

import { useEffect, useState, useRef } from 'react'
import { FOUNDATION_TIERS, ADDON_CATALOG, NONAVC_CATALOG } from '@/lib/g2-catalog'
import { fmtUSD } from '@/lib/g2-pricing'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SkuOverride {
  sku_id: string
  enabled: boolean
  custom_data: {
    tiers?: { index: number; price: number }[]
    listPrice?: number
  }
}

interface CatalogState {
  foundation: Record<string, SkuOverride>
  addons: Record<string, SkuOverride>
  nonavc: Record<string, SkuOverride>
}

type TabKey = 'foundation' | 'addons' | 'nonavc'

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ProductReferencePage() {
  const [tab, setTab] = useState<TabKey>('foundation')
  const [overrides, setOverrides] = useState<CatalogState>({
    foundation: {},
    addons: {},
    nonavc: {},
  })
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ updated?: number; errors?: string[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ─── load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const [skusRes, meRes] = await Promise.all([
          fetch('/api/g2-skus'),
          fetch('/api/auth/me'),
        ])
        const [skusData, meData] = await Promise.all([skusRes.json(), meRes.json()])

        // Build lookup by sku_id
        const foundationMap: Record<string, SkuOverride> = {}
        const addonsMap: Record<string, SkuOverride> = {}
        const nonavcMap: Record<string, SkuOverride> = {}

        ;(skusData.foundation || []).forEach((o: SkuOverride) => { foundationMap[o.sku_id] = o })
        ;(skusData.addons || []).forEach((o: SkuOverride) => { addonsMap[o.sku_id] = o })
        ;(skusData.nonavc || []).forEach((o: SkuOverride) => { nonavcMap[o.sku_id] = o })

        setOverrides({ foundation: foundationMap, addons: addonsMap, nonavc: nonavcMap })
        setIsAdmin(!meData?.role || meData.role === 'admin')
      } catch {
        // leave defaults
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ─── toggle enabled ────────────────────────────────────────────────────────

  async function toggleEnabled(skuId: string, skuType: 'foundation' | 'addon' | 'nonavc', current: boolean) {
    setSaving(skuId)
    try {
      const res = await fetch('/api/g2-skus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku_id: skuId, sku_type: skuType, enabled: !current }),
      })
      if (res.ok) {
        const mapKey = skuType === 'addon' ? 'addons' : skuType === 'nonavc' ? 'nonavc' : 'foundation'
        setOverrides(prev => ({
          ...prev,
          [mapKey]: {
            ...prev[mapKey],
            [skuId]: { ...(prev[mapKey][skuId] || { sku_id: skuId, custom_data: {} }), enabled: !current },
          },
        }))
      }
    } finally {
      setSaving(null)
    }
  }

  // ─── file upload ───────────────────────────────────────────────────────────

  async function handleUpload(file: File) {
    setUploading(true)
    setUploadResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/g2-skus/upload', { method: 'POST', body: formData })
      const data = await res.json()
      setUploadResult(data)
      // Reload overrides
      const skusRes = await fetch('/api/g2-skus')
      const skusData = await skusRes.json()
      const foundationMap: Record<string, SkuOverride> = {}
      const addonsMap: Record<string, SkuOverride> = {}
      const nonavcMap: Record<string, SkuOverride> = {}
      ;(skusData.foundation || []).forEach((o: SkuOverride) => { foundationMap[o.sku_id] = o })
      ;(skusData.addons || []).forEach((o: SkuOverride) => { addonsMap[o.sku_id] = o })
      ;(skusData.nonavc || []).forEach((o: SkuOverride) => { nonavcMap[o.sku_id] = o })
      setOverrides({ foundation: foundationMap, addons: addonsMap, nonavc: nonavcMap })
    } catch {
      setUploadResult({ errors: ['Upload failed. Please try again.'] })
    } finally {
      setUploading(false)
    }
  }

  // ─── helpers ───────────────────────────────────────────────────────────────

  function isEnabled(skuId: string, mapKey: 'foundation' | 'addons' | 'nonavc'): boolean {
    const o = overrides[mapKey][skuId]
    return o ? o.enabled !== false : true
  }

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'foundation', label: 'Foundation Tiers', count: FOUNDATION_TIERS.length },
    { key: 'addons', label: 'Add-Ons', count: ADDON_CATALOG.length },
    { key: 'nonavc', label: 'Non-ACV Items', count: NONAVC_CATALOG.length },
  ]

  // ─── render ────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="p-6 text-center text-gray-400 py-16">Loading...</div>
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Reference</h1>
          <p className="text-gray-500 text-sm mt-1">G2 catalog — all SKUs available for proposals and quotes</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setShowUpload(true); setUploadResult(null) }}
            className="btn-secondary"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload SKUs
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-red-500 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            style={tab === t.key ? { borderColor: '#FF492C', color: '#FF492C' } : {}}
          >
            {t.label}
            <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{t.count}</span>
          </button>
        ))}
      </div>

      {/* Foundation Tiers */}
      {tab === 'foundation' && (
        <div className="grid grid-cols-3 gap-4">
          {FOUNDATION_TIERS.map(tier => {
            const enabled = isEnabled(tier.id, 'foundation')
            return (
              <div
                key={tier.id}
                className={`card p-5 ${!enabled ? 'opacity-50' : ''}`}
                style={{ borderTop: `3px solid ${tier.color}` }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-gray-900">{tier.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{tier.headline}</p>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => toggleEnabled(tier.id, 'foundation', enabled)}
                      disabled={saving === tier.id}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out ${
                        enabled ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                      title={enabled ? 'Disable SKU' : 'Enable SKU'}
                    >
                      <span
                        className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${
                          enabled ? 'translate-x-4' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  )}
                </div>
                <div className="text-2xl font-bold mb-3" style={{ color: tier.color }}>
                  {tier.listPrice > 0 ? fmtUSD(tier.listPrice) : 'Free'}
                  {tier.listPrice > 0 && <span className="text-sm font-normal text-gray-400">/yr</span>}
                </div>
                <ul className="space-y-1">
                  {tier.highlights.map((h, i) => (
                    <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                      <svg className="w-3 h-3 mt-0.5 flex-shrink-0 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {h}
                    </li>
                  ))}
                </ul>
                {!enabled && isAdmin && (
                  <p className="mt-3 text-xs text-red-500 font-medium">Disabled — hidden from users</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add-Ons */}
      {tab === 'addons' && (
        <div className="space-y-4">
          {ADDON_CATALOG.map(addon => {
            const enabled = isEnabled(addon.id, 'addons')
            if (!isAdmin && !enabled) return null
            return (
              <div
                key={addon.id}
                className={`card overflow-hidden ${!enabled ? 'opacity-60' : ''}`}
              >
                <div className="card-header" style={{ borderLeft: `4px solid ${addon.color}` }}>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{addon.name}</h3>
                    <span className="text-xs text-gray-400">({addon.tiers.length} tier{addon.tiers.length !== 1 ? 's' : ''})</span>
                    {addon.catPricing && (
                      <span className="text-xs badge-purple">Category Pricing</span>
                    )}
                    {addon.noDisc && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">Non-discountable</span>
                    )}
                    {!enabled && (
                      <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Disabled</span>
                    )}
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => toggleEnabled(addon.id, 'addon', enabled)}
                      disabled={saving === addon.id}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out ${
                        enabled ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                      title={enabled ? 'Disable SKU' : 'Enable SKU'}
                    >
                      <span
                        className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${
                          enabled ? 'translate-x-4' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  )}
                </div>

                {/* Category pricing info */}
                {addon.catPricing && (
                  <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-700">
                    All-categories: <strong>{fmtUSD(addon.allCatPrice ?? 0)}</strong>
                    {' | '}Volume tiers: {addon.catVolume?.map(r => `${r.minCats}+ cats @ ${fmtUSD(r.perCatPrice)}/cat`).join(', ')}
                  </div>
                )}

                {/* Tier table */}
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="table-header">Tier</th>
                      <th className="table-header text-right">List Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {addon.tiers.map((tier, i) => (
                      <tr key={i} className="table-row">
                        <td className="table-cell text-gray-700">{tier.label}</td>
                        <td className="table-cell text-right font-medium text-gray-900">
                          {tier.custom ? (
                            <span className="text-gray-400 text-xs">Custom / TBD</span>
                          ) : tier.price > 0 ? (
                            fmtUSD(tier.price)
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}

      {/* Non-ACV Items */}
      {tab === 'nonavc' && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-header">Item</th>
                <th className="table-header">Note</th>
                <th className="table-header text-right">List Price</th>
                {isAdmin && <th className="table-header text-center">Enabled</th>}
              </tr>
            </thead>
            <tbody>
              {NONAVC_CATALOG.map(item => {
                const enabled = isEnabled(item.id, 'nonavc')
                if (!isAdmin && !enabled) return null
                return (
                  <tr key={item.id} className={`table-row ${!enabled ? 'opacity-50' : ''}`}>
                    <td className="table-cell">
                      <span className="font-medium text-gray-900">{item.name}</span>
                      {!enabled && isAdmin && (
                        <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Disabled</span>
                      )}
                    </td>
                    <td className="table-cell text-xs text-gray-400">{item.note}</td>
                    <td className="table-cell text-right font-medium text-gray-900">
                      {item.listPrice > 0 ? fmtUSD(item.listPrice) : 'Variable'}
                    </td>
                    {isAdmin && (
                      <td className="table-cell text-center">
                        <button
                          onClick={() => toggleEnabled(item.id, 'nonavc', enabled)}
                          disabled={saving === item.id}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out ${
                            enabled ? 'bg-green-500' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${
                              enabled ? 'translate-x-4' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Upload SKUs</h3>
              <button
                onClick={() => { setShowUpload(false); setUploadResult(null) }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Upload an Excel (.xlsx) or CSV file with columns: <code className="bg-gray-100 px-1 rounded">sku_id</code>, <code className="bg-gray-100 px-1 rounded">enabled</code> (true/false).
            </p>

            <div
              className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center cursor-pointer hover:border-gray-300 transition-colors mb-4"
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault()
                const file = e.dataTransfer.files[0]
                if (file) handleUpload(file)
              }}
            >
              <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm text-gray-500">
                {uploading ? 'Uploading...' : 'Click or drag & drop file here'}
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.csv"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) handleUpload(file)
                }}
              />
            </div>

            {uploadResult && (
              <div className={`p-3 rounded-lg text-sm ${uploadResult.errors?.length ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {uploadResult.updated != null && (
                  <p className="font-medium">Updated {uploadResult.updated} SKU{uploadResult.updated !== 1 ? 's' : ''}</p>
                )}
                {uploadResult.errors?.length ? (
                  <ul className="mt-1 space-y-0.5">
                    {uploadResult.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}

            <div className="flex justify-end mt-4">
              <button
                onClick={() => { setShowUpload(false); setUploadResult(null) }}
                className="btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
