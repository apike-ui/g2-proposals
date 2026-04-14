'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  FOUNDATION_TIERS, ADDON_CATALOG, NONAVC_CATALOG,
  ProposalProduct, ProposalSnapshot, AddonState, AcctItems,
} from '@/lib/g2-catalog'
import { calcGrandTotal, calcProductTotal, buildMultiYearTable, fmtUSD } from '@/lib/g2-pricing'

interface RateCardOption { id: string; name: string; customer: string }
interface VersionEntry { id: string; version_number: number; notes: string; created_at: string }
interface SkuState { id: string; enabled: boolean }

let nextId = 1
function mkProduct(name?: string): ProposalProduct {
  const id = nextId++
  const addons: Record<string, AddonState> = {}
  for (const a of ADDON_CATALOG) {
    addons[a.id] = { on: false, tierIdx: 0, qty: 1, rate: '', disc: '', cats: '', allCats: false }
  }
  return { id, name: name || `Product ${id}`, basePkg: 'professional', baseRate: '', baseDisc: '', addons }
}

export default function ProposalBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [proposalName, setProposalName] = useState('Untitled Proposal')
  const [cust, setCust] = useState('')
  const [rep, setRep] = useState('')
  const [products, setProducts] = useState<ProposalProduct[]>([])
  const [acctItems, setAcctItems] = useState<AcctItems>({})
  const [proposalDisc, setProposalDisc] = useState('')
  const [contractTerm, setContractTerm] = useState('12')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [rateCardId, setRateCardId] = useState<string>('')
  const [rateCardData, setRateCardData] = useState<unknown>(null)
  const [rateCardOptions, setRateCardOptions] = useState<RateCardOption[]>([])
  const [activeTab, setActiveTab] = useState<'builder' | 'history'>('builder')
  const [activeProductIdx, setActiveProductIdx] = useState(0)
  const [versions, setVersions] = useState<VersionEntry[]>([])
  const [enabledAddons, setEnabledAddons] = useState<Set<string>>(new Set(ADDON_CATALOG.map(a => a.id)))
  const [enabledNonavc, setEnabledNonavc] = useState<Set<string>>(new Set(NONAVC_CATALOG.map(n => n.id)))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveNote, setSaveNote] = useState('')
  const [savedMsg, setSavedMsg] = useState(false)
  const [creatingQuote, setCreatingQuote] = useState(false)
  const [exporting, setExporting] = useState(false)

  const buildSnapshot = useCallback((): ProposalSnapshot => ({
    cust, rep, products, acctItems, proposalDisc,
    contractTerm, startDate, endDate,
    rateCardId: rateCardId || undefined,
  }), [cust, rep, products, acctItems, proposalDisc, contractTerm, startDate, endDate, rateCardId])

  const rcData = rateCardData as Parameters<typeof calcGrandTotal>[1]
  const grandTotal = calcGrandTotal(buildSnapshot(), rcData)

  useEffect(() => {
    async function load() {
      try {
        const [propRes, rcRes, skuRes] = await Promise.all([
          fetch(`/api/proposals/${id}`),
          fetch('/api/rate-cards'),
          fetch('/api/g2-skus'),
        ])
        const [propData, rcData2, skuData] = await Promise.all([
          propRes.json(), rcRes.json(), skuRes.json(),
        ])

        if (propData.proposal) {
          const p = propData.proposal
          setProposalName(p.name)
          setCust(p.customer || '')
          setRep(p.rep || '')
          if (p.rate_card_id) setRateCardId(p.rate_card_id)
        }

        if (propData.latestVersion?.snapshot) {
          const snap: ProposalSnapshot = propData.latestVersion.snapshot
          setCust(snap.cust || '')
          setRep(snap.rep || '')
          if (snap.products?.length) { nextId = Math.max(...snap.products.map((p: ProposalProduct) => p.id)) + 1; setProducts(snap.products) }
          if (snap.acctItems) setAcctItems(snap.acctItems)
          if (snap.proposalDisc) setProposalDisc(snap.proposalDisc)
          if (snap.contractTerm) setContractTerm(snap.contractTerm)
          if (snap.startDate) setStartDate(snap.startDate)
          if (snap.endDate) setEndDate(snap.endDate)
          if (snap.rateCardId) setRateCardId(snap.rateCardId)
        } else if (!propData.latestVersion) {
          setProducts([mkProduct('Product 1')])
        }

        setRateCardOptions(rcData2.rateCards || [])

        if (skuData.addons) setEnabledAddons(new Set(skuData.addons.filter((a: SkuState) => a.enabled).map((a: SkuState) => a.id)))
        if (skuData.nonavc) setEnabledNonavc(new Set(skuData.nonavc.filter((n: SkuState) => n.enabled).map((n: SkuState) => n.id)))
      } catch {
        setProducts([mkProduct('Product 1')])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  // Load rate card data when rateCardId changes
  useEffect(() => {
    if (!rateCardId) { setRateCardData(null); return }
    fetch(`/api/rate-cards/${rateCardId}`)
      .then(r => r.json())
      .then(d => setRateCardData(d.rateCard?.card_data || null))
      .catch(() => setRateCardData(null))
  }, [rateCardId])

  async function loadVersions() {
    const res = await fetch(`/api/proposals/${id}/versions`)
    const data = await res.json()
    setVersions(data.versions || [])
  }

  useEffect(() => { if (activeTab === 'history') loadVersions() }, [activeTab])

  async function saveVersion() {
    setSaving(true)
    try {
      const snapshot = buildSnapshot()
      await fetch(`/api/proposals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: proposalName, customer: cust, rep, rate_card_id: rateCardId || null, grand_total: grandTotal }),
      })
      await fetch(`/api/proposals/${id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot, notes: saveNote, grandTotal }),
      })
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 2500)
      setShowSaveModal(false)
      setSaveNote('')
    } catch { /* ignore */ } finally {
      setSaving(false)
    }
  }

  async function loadVersion(versionId: string) {
    try {
      const res = await fetch(`/api/versions/${versionId}`)
      const data = await res.json()
      if (!data.version?.snapshot) return
      const snap: ProposalSnapshot = data.version.snapshot
      setCust(snap.cust || '')
      setRep(snap.rep || '')
      if (snap.products?.length) { nextId = Math.max(...snap.products.map((p: ProposalProduct) => p.id)) + 1; setProducts(snap.products) }
      if (snap.acctItems) setAcctItems(snap.acctItems)
      setProposalDisc(snap.proposalDisc || '')
      setContractTerm(snap.contractTerm || '12')
      setStartDate(snap.startDate || '')
      setEndDate(snap.endDate || '')
      setRateCardId(snap.rateCardId || '')
      setActiveTab('builder')
    } catch { /* ignore */ }
  }

  async function createQuote() {
    setCreatingQuote(true)
    try {
      await saveVersion()
      const res = await fetch(`/api/proposals/${id}/create-quote`, { method: 'POST' })
      const data = await res.json()
      if (data.quoteId) router.push(`/quotes/${data.quoteId}`)
      else alert(data.error || 'Failed to create quote')
    } catch { /* ignore */ } finally {
      setCreatingQuote(false)
    }
  }

  async function exportPptx() {
    setExporting(true)
    try {
      const snapshot = buildSnapshot()
      const res = await fetch('/api/proposals/export-pptx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot, rateCard: rateCardData, proposalName }),
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${proposalName.replace(/[^a-z0-9]/gi, '_')}_Proposal.pptx`
      a.click()
      URL.revokeObjectURL(url)
    } catch { alert('Failed to export PPTX') } finally {
      setExporting(false)
    }
  }

  function updateProduct(idx: number, updates: Partial<ProposalProduct>) {
    setProducts(ps => ps.map((p, i) => i === idx ? { ...p, ...updates } : p))
  }

  function updateAddon(idx: number, addonId: string, updates: Partial<AddonState>) {
    setProducts(ps => ps.map((p, i) => i === idx
      ? { ...p, addons: { ...p.addons, [addonId]: { ...p.addons[addonId], ...updates } } }
      : p))
  }

  function removeProduct(idx: number) {
    setProducts(ps => ps.filter((_, i) => i !== idx))
    if (activeProductIdx >= idx && activeProductIdx > 0) setActiveProductIdx(activeProductIdx - 1)
  }

  const enabledAddonList = ADDON_CATALOG.filter(a => enabledAddons.has(a.id))
  const enabledNonavcList = NONAVC_CATALOG.filter(n => enabledNonavc.has(n.id))
  const activeProduct = products[activeProductIdx]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-t-transparent rounded-full" style={{ borderColor: '#FF492C', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/proposals')} className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <input
              value={proposalName}
              onChange={e => setProposalName(e.target.value)}
              className="text-xl font-bold text-gray-900 border-none outline-none bg-transparent focus:ring-0 min-w-0"
              placeholder="Proposal name"
            />
          </div>
          <div className="flex items-center gap-2">
            {savedMsg && <span className="text-green-600 text-sm font-medium">Saved!</span>}
            <button onClick={exportPptx} disabled={exporting} className="btn-secondary btn-sm">
              {exporting ? 'Exporting...' : 'Export PPTX'}
            </button>
            <button
              onClick={createQuote}
              disabled={creatingQuote}
              className="btn-secondary btn-sm"
            >
              {creatingQuote ? 'Creating...' : 'Create Quote'}
            </button>
            <button
              onClick={() => setShowSaveModal(true)}
              className="btn-primary btn-sm"
              style={{ backgroundColor: '#FF492C' }}
            >
              Save Version
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mt-3 border-b border-gray-100 -mb-4">
          {(['builder', 'history'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-1 py-2 text-sm font-medium border-b-2 -mb-px capitalize transition-colors ${
                activeTab === tab ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500'
              }`}
              style={activeTab === tab ? { borderColor: '#FF492C', color: '#FF492C' } : {}}
            >
              {tab === 'builder' ? 'Builder' : 'Version History'}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'history' ? (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto">
            <div className="card overflow-hidden">
              <div className="card-header">
                <h2 className="font-semibold text-gray-900">Saved Versions</h2>
                <button onClick={loadVersions} className="text-sm text-blue-600 hover:text-blue-800">Refresh</button>
              </div>
              {versions.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">No saved versions yet. Save a version from the Builder tab.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {versions.map(v => (
                    <div key={v.id} className="flex items-center justify-between px-5 py-4">
                      <div>
                        <p className="font-medium text-gray-900">Version {v.version_number}</p>
                        {v.notes && <p className="text-sm text-gray-500 mt-0.5">{v.notes}</p>}
                        <p className="text-xs text-gray-400 mt-1">{new Date(v.created_at).toLocaleString()}</p>
                      </div>
                      <button onClick={() => loadVersion(v.id)} className="btn-secondary btn-sm">
                        Load
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden flex">
          {/* Left: Builder panel */}
          <div className="flex-1 overflow-y-auto p-6 min-w-0">
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Meta fields */}
              <div className="card p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Proposal Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Customer / Company</label>
                    <input className="input" value={cust} onChange={e => setCust(e.target.value)} placeholder="Acme Corp" />
                  </div>
                  <div>
                    <label className="label">Account Executive</label>
                    <input className="input" value={rep} onChange={e => setRep(e.target.value)} placeholder="Your name" />
                  </div>
                  <div>
                    <label className="label">Rate Card</label>
                    <select
                      className="input"
                      value={rateCardId}
                      onChange={e => setRateCardId(e.target.value)}
                    >
                      <option value="">No rate card (list prices)</option>
                      {rateCardOptions.map(rc => (
                        <option key={rc.id} value={rc.id}>{rc.name}{rc.customer ? ` — ${rc.customer}` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Proposal Discount (%)</label>
                    <input
                      className="input"
                      type="number" min="0" max="100" step="0.5"
                      value={proposalDisc}
                      onChange={e => setProposalDisc(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Contract terms */}
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="label">Contract Term</label>
                    <select className="input" value={contractTerm} onChange={e => setContractTerm(e.target.value)}>
                      <option value="6">6 Months</option>
                      <option value="12">12 Months</option>
                      <option value="24">24 Months</option>
                      <option value="36">36 Months</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Start Date</label>
                    <input className="input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">End Date</label>
                    <input className="input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Product tabs */}
              <div className="card">
                <div className="card-header">
                  <div className="flex items-center gap-2 overflow-x-auto">
                    {products.map((p, i) => (
                      <button
                        key={p.id}
                        onClick={() => setActiveProductIdx(i)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                          activeProductIdx === i
                            ? 'text-white'
                            : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                        }`}
                        style={activeProductIdx === i ? { backgroundColor: '#FF492C' } : {}}
                      >
                        {p.name}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        const p = mkProduct()
                        setProducts(ps => [...ps, p])
                        setActiveProductIdx(products.length)
                      }}
                      className="px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-100 whitespace-nowrap"
                    >
                      + Add Product
                    </button>
                  </div>
                </div>

                {activeProduct && (
                  <div className="p-5 space-y-5">
                    {/* Product name + remove */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="label">Product Name</label>
                        <input
                          className="input"
                          value={activeProduct.name}
                          onChange={e => updateProduct(activeProductIdx, { name: e.target.value })}
                          placeholder="e.g. Main Product"
                        />
                      </div>
                      {products.length > 1 && (
                        <button
                          onClick={() => removeProduct(activeProductIdx)}
                          className="mt-6 text-red-400 hover:text-red-600 text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {/* Base Package */}
                    <div>
                      <label className="label">Foundation Package</label>
                      <div className="grid grid-cols-3 gap-3">
                        {FOUNDATION_TIERS.map(tier => (
                          <button
                            key={tier.id}
                            onClick={() => updateProduct(activeProductIdx, { basePkg: tier.id })}
                            className={`p-3 rounded-xl border-2 text-left transition-all ${
                              activeProduct.basePkg === tier.id
                                ? 'border-current shadow-sm'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                            style={activeProduct.basePkg === tier.id ? { borderColor: tier.color } : {}}
                          >
                            <p className="text-xs font-semibold" style={{ color: tier.color }}>{tier.name}</p>
                            <p className="text-sm font-bold text-gray-900 mt-1">
                              {tier.listPrice === 0 ? 'Free' : `$${tier.listPrice.toLocaleString()}/yr`}
                            </p>
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <label className="label text-xs">Custom Price Override</label>
                          <input
                            className="input"
                            type="number" min="0"
                            value={activeProduct.baseRate}
                            onChange={e => updateProduct(activeProductIdx, { baseRate: e.target.value })}
                            placeholder="Override list price"
                          />
                        </div>
                        <div>
                          <label className="label text-xs">Discount (%)</label>
                          <input
                            className="input"
                            type="number" min="0" max="100"
                            value={activeProduct.baseDisc}
                            onChange={e => updateProduct(activeProductIdx, { baseDisc: e.target.value })}
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Add-ons */}
                    {enabledAddonList.length > 0 && (
                      <div>
                        <label className="label">Add-Ons</label>
                        <div className="space-y-3">
                          {enabledAddonList.map(addon => {
                            const state = activeProduct.addons[addon.id] || { on: false, tierIdx: 0, qty: 1, rate: '', disc: '' }
                            return (
                              <div
                                key={addon.id}
                                className={`rounded-xl border p-3 transition-all ${state.on ? 'border-gray-300 bg-gray-50' : 'border-gray-200'}`}
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={state.on}
                                    onChange={e => updateAddon(activeProductIdx, addon.id, { on: e.target.checked })}
                                    className="w-4 h-4 rounded"
                                  />
                                  <span
                                    className="text-sm font-medium px-2 py-0.5 rounded-full text-white"
                                    style={{ backgroundColor: addon.color }}
                                  >
                                    {addon.name}
                                  </span>
                                  {addon.noDisc && <span className="text-xs text-gray-400">non-discountable</span>}
                                </div>
                                {state.on && (
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                                    <div className="col-span-2">
                                      <label className="label text-xs">Tier</label>
                                      <select
                                        className="input"
                                        value={state.tierIdx}
                                        onChange={e => updateAddon(activeProductIdx, addon.id, { tierIdx: parseInt(e.target.value) })}
                                      >
                                        {addon.tiers.map((t, ti) => (
                                          <option key={ti} value={ti}>
                                            {t.label}{t.price > 0 ? ` — $${t.price.toLocaleString()}` : ''}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="label text-xs">Qty</label>
                                      <input
                                        className="input"
                                        type="number" min="1"
                                        value={state.qty}
                                        onChange={e => updateAddon(activeProductIdx, addon.id, { qty: parseInt(e.target.value) || 1 })}
                                      />
                                    </div>
                                    <div>
                                      <label className="label text-xs">Disc %</label>
                                      <input
                                        className="input"
                                        type="number" min="0" max="100"
                                        value={state.disc}
                                        onChange={e => updateAddon(activeProductIdx, addon.id, { disc: e.target.value })}
                                        disabled={addon.noDisc}
                                        placeholder="0"
                                      />
                                    </div>
                                    <div className="col-span-2">
                                      <label className="label text-xs">Custom Price</label>
                                      <input
                                        className="input"
                                        type="number" min="0"
                                        value={state.rate}
                                        onChange={e => updateAddon(activeProductIdx, addon.id, { rate: e.target.value })}
                                        placeholder="Override price"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Non-ACV Items */}
              {enabledNonavcList.length > 0 && (
                <div className="card p-5">
                  <h3 className="font-semibold text-gray-900 mb-4">Non-ACV Items (Account Level)</h3>
                  <div className="space-y-2">
                    {enabledNonavcList.map(item => {
                      const state = acctItems[item.id] || { qty: 0, rate: '' }
                      return (
                        <div key={item.id} className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{item.name}</p>
                            <p className="text-xs text-gray-400">{item.note}</p>
                          </div>
                          <div className="flex gap-2 items-center">
                            <div>
                              <label className="label text-xs sr-only">Qty</label>
                              <input
                                className="input w-20"
                                type="number" min="0"
                                value={state.qty || ''}
                                onChange={e => setAcctItems(ai => ({ ...ai, [item.id]: { ...state, qty: parseInt(e.target.value) || 0 } }))}
                                placeholder="Qty"
                              />
                            </div>
                            <div>
                              <input
                                className="input w-28"
                                type="number" min="0"
                                value={state.rate || ''}
                                onChange={e => setAcctItems(ai => ({ ...ai, [item.id]: { ...state, rate: e.target.value } }))}
                                placeholder={item.listPrice > 0 ? `$${item.listPrice.toLocaleString()}` : 'Custom $'}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Pricing Summary */}
          <div className="w-80 flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Pricing Summary</h3>

            {/* Per-product subtotals */}
            <div className="space-y-2 mb-4">
              {products.map((p) => {
                const total = calcProductTotal(p, rcData, parseFloat(proposalDisc) || 0)
                return (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 truncate">{p.name}</span>
                    <span className="font-medium text-gray-900 ml-2">{fmtUSD(total)}</span>
                  </div>
                )
              })}
            </div>

            <div className="border-t border-gray-100 pt-3 mb-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Grand Total</span>
                <span className="text-lg font-bold" style={{ color: '#FF492C' }}>{fmtUSD(grandTotal)}</span>
              </div>
              {rateCardId && (
                <p className="text-xs text-blue-600 mt-1">Rate card pricing applied</p>
              )}
              {(parseFloat(proposalDisc) || 0) > 0 && (
                <p className="text-xs text-green-600 mt-1">{proposalDisc}% proposal discount applied</p>
              )}
            </div>

            {/* Multi-year table */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Multi-Year View</p>
              <div className="rounded-lg overflow-hidden border border-gray-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500" style={{ backgroundColor: '#062846' }}>
                      <th className="px-3 py-2 text-left font-medium text-white">Period</th>
                      <th className="px-3 py-2 text-right font-medium text-white">Annual ACV</th>
                      <th className="px-3 py-2 text-right font-medium text-white">Cumulative</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buildMultiYearTable(grandTotal * (12 / (parseInt(contractTerm) || 12)), contractTerm).map(row => (
                      <tr key={row.label} className="border-t border-gray-100">
                        <td className="px-3 py-2 text-gray-700">{row.label}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{fmtUSD(row.annualAcv)}</td>
                        <td className="px-3 py-2 text-right font-medium" style={{ color: '#FF492C' }}>{fmtUSD(row.totalValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="font-bold text-gray-900 mb-4">Save Version</h3>
            <label className="label">Notes (optional)</label>
            <textarea
              className="input resize-none"
              rows={3}
              value={saveNote}
              onChange={e => setSaveNote(e.target.value)}
              placeholder="Describe what changed in this version..."
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowSaveModal(false)} className="btn-secondary">Cancel</button>
              <button
                onClick={saveVersion}
                disabled={saving}
                className="btn-primary"
                style={{ backgroundColor: '#FF492C' }}
              >
                {saving ? 'Saving...' : 'Save Version'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
