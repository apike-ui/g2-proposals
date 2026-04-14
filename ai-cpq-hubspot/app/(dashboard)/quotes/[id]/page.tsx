'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Quote, Product } from '@/lib/supabase'

const statusColors: Record<string, string> = {
  draft: 'badge-gray', sent: 'badge-blue', accepted: 'badge-green',
  rejected: 'badge-red', expired: 'badge-yellow',
}

const FIELD_LABELS: Record<string, string> = {
  status: 'Status',
  customer_name: 'Customer Name',
  customer_email: 'Email',
  customer_company: 'Company',
  notes: 'Notes',
  valid_until: 'Valid Until',
  line_items: 'Line Items',
}

interface AuditEntry {
  id: string
  username: string
  display_name?: string
  changed_fields: string[]
  old_values: Record<string, unknown>
  new_values: Record<string, unknown>
  created_at: string
}

interface EditItem {
  tempId: string
  product_id: string
  sku: string
  name: string
  quantity: number
  unit_price: number
  discount_percent: number
  total_price: number
  notes: string
}

function calcTotal(qty: number, price: number, disc: number) {
  return Number((qty * price * (1 - disc / 100)).toFixed(2))
}

function fmtValue(field: string, val: unknown): string {
  if (val == null || val === '') return '—'
  if (field === 'valid_until') {
    try { return new Date(String(val)).toLocaleDateString() } catch { return String(val) }
  }
  return String(val)
}

let _tempId = 0
function nextTempId() { return String(++_tempId) }

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [generatingAI, setGeneratingAI] = useState(false)
  const [converting, setConverting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [shippingAddress, setShippingAddress] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [syncHubSpot, setSyncHubSpot] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'info' | 'success' | 'error'>('info')

  // ── Edit mode ──────────────────────────────────────────
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    customer_name: '', customer_email: '', customer_company: '',
    notes: '', valid_until: '', status: 'draft',
  })
  const [editItems, setEditItems] = useState<EditItem[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [showAddItem, setShowAddItem] = useState(false)
  const [newItemProductId, setNewItemProductId] = useState('')
  const [newItemQty, setNewItemQty] = useState(1)
  const [newItemDiscount, setNewItemDiscount] = useState(0)

  // ── Audit log ──────────────────────────────────────────
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [auditLoading, setAuditLoading] = useState(true)

  const fetchQuote = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/quotes/${id}`)
      const data = await res.json()
      setQuote(data.quote || null)
    } catch {
      setQuote(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  const fetchAuditLog = useCallback(async () => {
    setAuditLoading(true)
    try {
      const res = await fetch(`/api/quotes/${id}/audit`)
      const data = await res.json()
      setAuditEntries(data.entries || [])
    } catch {
      setAuditEntries([])
    } finally {
      setAuditLoading(false)
    }
  }, [id])

  useEffect(() => { fetchQuote() }, [fetchQuote])
  useEffect(() => { fetchAuditLog() }, [fetchAuditLog])

  // ── Enter / exit edit mode ─────────────────────────────
  function enterEdit() {
    if (!quote) return
    setEditForm({
      customer_name: quote.customer_name || '',
      customer_email: quote.customer_email || '',
      customer_company: quote.customer_company || '',
      notes: quote.notes || '',
      valid_until: quote.valid_until ? quote.valid_until.substring(0, 10) : '',
      status: quote.status,
    })
    setEditItems(
      (quote.items || []).map(item => ({
        tempId: nextTempId(),
        product_id: item.product_id,
        sku: item.product?.sku || '',
        name: item.product?.name || '',
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent || 0,
        total_price: item.total_price,
        notes: item.notes || '',
      }))
    )
    if (allProducts.length === 0) {
      fetch('/api/products').then(r => r.json()).then(d => setAllProducts(d.products || [])).catch(() => {})
    }
    setShowAddItem(false)
    setEditMode(true)
  }

  function cancelEdit() { setEditMode(false); setShowAddItem(false) }

  // ── Edit item helpers ──────────────────────────────────
  function updateItem(idx: number, patch: Partial<EditItem>) {
    setEditItems(prev => {
      const next = [...prev]
      const item = { ...next[idx], ...patch }
      item.total_price = calcTotal(item.quantity, item.unit_price, item.discount_percent)
      next[idx] = item
      return next
    })
  }

  function removeItem(idx: number) {
    setEditItems(prev => prev.filter((_, i) => i !== idx))
  }

  function addItem() {
    const product = allProducts.find(p => p.id === newItemProductId)
    if (!product) return
    setEditItems(prev => [...prev, {
      tempId: nextTempId(),
      product_id: product.id,
      sku: product.sku,
      name: product.name,
      quantity: newItemQty,
      unit_price: product.price,
      discount_percent: newItemDiscount,
      total_price: calcTotal(newItemQty, product.price, newItemDiscount),
      notes: '',
    }])
    setNewItemProductId('')
    setNewItemQty(1)
    setNewItemDiscount(0)
    setShowAddItem(false)
  }

  const editTotal = editItems.reduce((s, i) => s + i.total_price, 0)

  // ── Save ───────────────────────────────────────────────
  async function saveEdit() {
    setSaving(true)
    try {
      const res = await fetch(`/api/quotes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: editForm.status,
          customerName: editForm.customer_name,
          customerEmail: editForm.customer_email,
          customerCompany: editForm.customer_company,
          notes: editForm.notes || null,
          validUntil: editForm.valid_until || null,
          items: editItems.map(i => ({
            product_id: i.product_id,
            quantity: i.quantity,
            unit_price: i.unit_price,
            discount_percent: i.discount_percent,
            total_price: i.total_price,
            notes: i.notes || null,
          })),
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      setEditMode(false)
      setShowAddItem(false)
      await fetchQuote()
      await fetchAuditLog()
      showMsg('Quote saved', 'success')
    } catch {
      showMsg('Failed to save quote', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Helpers ────────────────────────────────────────────
  function showMsg(text: string, type: 'info' | 'success' | 'error' = 'info') {
    setMessage(text); setMessageType(type)
    setTimeout(() => setMessage(''), 4000)
  }

  async function updateStatus(status: string) {
    await fetch(`/api/quotes/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    fetchQuote()
  }

  async function generateAISummary() {
    if (!quote) return
    setGeneratingAI(true)
    try {
      const res = await fetch(`/api/quotes/${id}/ai-summary`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: quote.customer_name, customerCompany: quote.customer_company,
          items: quote.items?.map(i => ({ productName: i.product?.name, sku: i.product?.sku, quantity: i.quantity, unitPrice: i.unit_price, totalPrice: i.total_price })),
          total: quote.total_amount, notes: quote.notes,
        }),
      })
      const data = await res.json()
      if (data.summary) {
        await fetch(`/api/quotes/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aiSummary: data.summary }) })
        fetchQuote()
      }
    } catch { showMsg('AI summary failed', 'error') } finally { setGeneratingAI(false) }
  }

  async function handleConvertToOrder() {
    setConverting(true)
    try {
      const res = await fetch(`/api/quotes/${id}/convert`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shippingAddress, notes: orderNotes, syncToHubSpot: syncHubSpot }),
      })
      const data = await res.json()
      if (res.ok) { router.push(`/orders/${data.order.id}`) }
      else { showMsg(data.error || 'Conversion failed', 'error'); setConverting(false) }
    } catch { showMsg('Conversion failed', 'error'); setConverting(false) }
  }

  async function syncToHubSpotDeal() {
    if (!quote) return
    setSyncing(true)
    try {
      const res = await fetch('/api/hubspot/deals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealname: `${quote.quote_number} - ${quote.customer_company || quote.customer_name || 'Deal'}`, amount: quote.total_amount }),
      })
      const data = await res.json()
      if (data.dealId) {
        await fetch(`/api/quotes/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hubspotDealId: data.dealId }) })
        fetchQuote(); showMsg('Synced to HubSpot!', 'success')
      }
    } catch { showMsg('HubSpot sync failed', 'error') } finally { setSyncing(false) }
  }

  async function generatePDF() {
    if (!quote) return
    setGeneratingPDF(true)
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF()
      doc.setFillColor(37, 99, 235); doc.rect(0, 0, 210, 40, 'F')
      doc.setTextColor(255, 255, 255); doc.setFontSize(22); doc.setFont('helvetica', 'bold')
      doc.text('QUOTE', 15, 20); doc.setFontSize(11); doc.setFont('helvetica', 'normal')
      doc.text(quote.quote_number, 15, 30)
      doc.setTextColor(0, 0, 0); doc.setFontSize(11); doc.setFont('helvetica', 'bold')
      doc.text('Bill To:', 15, 55); doc.setFont('helvetica', 'normal')
      doc.text(quote.customer_name || '', 15, 63); doc.text(quote.customer_company || '', 15, 70); doc.text(quote.customer_email || '', 15, 77)
      doc.setFont('helvetica', 'bold'); doc.text('Quote Details:', 130, 55); doc.setFont('helvetica', 'normal')
      doc.text(`Date: ${new Date(quote.created_at).toLocaleDateString()}`, 130, 63)
      if (quote.valid_until) doc.text(`Valid Until: ${new Date(quote.valid_until).toLocaleDateString()}`, 130, 70)
      doc.text(`Status: ${quote.status.toUpperCase()}`, 130, 77)
      const tableData = (quote.items || []).map(item => [item.product?.sku || '', item.product?.name || '', item.quantity.toString(), `$${item.unit_price.toFixed(2)}`, item.discount_percent > 0 ? `${item.discount_percent}%` : '—', `$${item.total_price.toFixed(2)}`])
      autoTable(doc, { startY: 90, head: [['SKU', 'Product', 'Qty', 'Unit Price', 'Discount', 'Total']], body: tableData, headStyles: { fillColor: [37, 99, 235] }, alternateRowStyles: { fillColor: [245, 247, 250] }, margin: { left: 15, right: 15 } })
      const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13)
      doc.text(`Total: $${quote.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 140, finalY)
      if (quote.ai_summary) { doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('Summary:', 15, finalY + 20); doc.setFont('helvetica', 'normal'); doc.text(doc.splitTextToSize(quote.ai_summary, 180), 15, finalY + 28) }
      if (quote.notes) { const ny = quote.ai_summary ? finalY + 60 : finalY + 20; doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('Notes:', 15, ny); doc.setFont('helvetica', 'normal'); doc.text(doc.splitTextToSize(quote.notes, 180), 15, ny + 8) }
      doc.save(`${quote.quote_number}.pdf`)
    } catch { showMsg('PDF generation failed', 'error') } finally { setGeneratingPDF(false) }
  }

  // ── Render guards ──────────────────────────────────────
  if (loading) return <div className="p-6 text-center text-gray-400">Loading quote...</div>
  if (!quote) return <div className="p-6 text-center text-gray-400">Quote not found. <Link href="/quotes" className="text-blue-600">Back to quotes</Link></div>

  // ── Render ─────────────────────────────────────────────
  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Edit mode banner */}
      {editMode && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm font-medium flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Editing quote — changes are not saved until you click Save
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/quotes" className="text-gray-400 hover:text-gray-600">← Quotes</Link>
            <span className="font-mono font-bold text-xl text-gray-900">{quote.quote_number}</span>
            {editMode
              ? <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} className="input-field w-auto text-sm">
                  {['draft', 'sent', 'accepted', 'rejected', 'expired'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              : <span className={statusColors[quote.status] || 'badge-gray'}>{quote.status}</span>
            }
          </div>
          <p className="text-gray-500 text-sm mt-1">
            Created {new Date(quote.created_at).toLocaleDateString()}
            {quote.valid_until && ` · Valid until ${new Date(quote.valid_until).toLocaleDateString()}`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {editMode ? (
            <>
              <button onClick={cancelEdit} className="btn-secondary">Cancel</button>
              <button onClick={saveEdit} disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </>
          ) : (
            <>
              <select
                value={quote.status}
                onChange={e => updateStatus(e.target.value)}
                className="input-field w-auto text-sm"
              >
                {['draft', 'sent', 'accepted', 'rejected', 'expired'].map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
              <button onClick={enterEdit} className="btn-secondary">Edit Quote</button>
              <button onClick={generatePDF} disabled={generatingPDF} className="btn-secondary">
                {generatingPDF ? 'Generating…' : '📄 PDF'}
              </button>
              <button onClick={generateAISummary} disabled={generatingAI} className="btn-secondary">
                {generatingAI ? 'Generating…' : '🤖 AI Summary'}
              </button>
              {!quote.hubspot_deal_id && (
                <button onClick={syncToHubSpotDeal} disabled={syncing} className="btn-secondary">
                  {syncing ? 'Syncing…' : '⚡ HubSpot'}
                </button>
              )}
              <button
                onClick={() => setShowConvertModal(true)}
                disabled={quote.status === 'accepted'}
                className="btn-primary"
              >
                Convert to Order →
              </button>
            </>
          )}
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-3 border rounded-lg text-sm ${messageType === 'success' ? 'bg-green-50 border-green-200 text-green-700' : messageType === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — line items + AI summary + notes */}
        <div className="lg:col-span-2 space-y-6">

          {/* Line items */}
          <div className="card overflow-hidden">
            <div className="card-header flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Line Items</h2>
              {editMode && (
                <button onClick={() => setShowAddItem(true)} className="text-sm text-blue-600 hover:underline">
                  + Add item
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="table-header">SKU</th>
                    <th className="table-header">Product</th>
                    <th className="table-header">Qty</th>
                    <th className="table-header">Unit Price</th>
                    <th className="table-header">Disc%</th>
                    <th className="table-header">Total</th>
                    {editMode && <th className="table-header w-8"></th>}
                  </tr>
                </thead>
                <tbody>
                  {editMode ? (
                    editItems.length === 0 ? (
                      <tr><td colSpan={7} className="table-cell text-center text-gray-400 py-6">No items — click + Add item</td></tr>
                    ) : editItems.map((item, idx) => (
                      <tr key={item.tempId} className="table-row">
                        <td className="table-cell font-mono text-xs text-blue-700">{item.sku}</td>
                        <td className="table-cell">
                          <p className="font-medium text-sm">{item.name}</p>
                          <input
                            value={item.notes} placeholder="Line note…"
                            onChange={e => updateItem(idx, { notes: e.target.value })}
                            className="mt-1 w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </td>
                        <td className="table-cell">
                          <input type="number" min={1} value={item.quantity}
                            onChange={e => updateItem(idx, { quantity: Math.max(1, Number(e.target.value)) })}
                            className="w-16 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </td>
                        <td className="table-cell">
                          <input type="number" min={0} step="0.01" value={item.unit_price}
                            onChange={e => updateItem(idx, { unit_price: Number(e.target.value) })}
                            className="w-24 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </td>
                        <td className="table-cell">
                          <input type="number" min={0} max={100} value={item.discount_percent}
                            onChange={e => updateItem(idx, { discount_percent: Math.min(100, Number(e.target.value)) })}
                            className="w-16 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </td>
                        <td className="table-cell font-semibold">${item.total_price.toFixed(2)}</td>
                        <td className="table-cell">
                          <button onClick={() => removeItem(idx)} className="text-gray-400 hover:text-red-500" title="Remove">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    (quote.items || []).length === 0 ? (
                      <tr><td colSpan={6} className="table-cell text-center text-gray-400 py-6">No items</td></tr>
                    ) : (quote.items || []).map(item => (
                      <tr key={item.id} className="table-row">
                        <td className="table-cell font-mono text-xs text-blue-700">{item.product?.sku}</td>
                        <td className="table-cell">
                          <p className="font-medium">{item.product?.name}</p>
                          {item.notes && <p className="text-xs text-gray-500 mt-0.5">{item.notes}</p>}
                        </td>
                        <td className="table-cell">{item.quantity}</td>
                        <td className="table-cell">${item.unit_price.toFixed(2)}</td>
                        <td className="table-cell">{item.discount_percent > 0 ? `${item.discount_percent}%` : '—'}</td>
                        <td className="table-cell font-semibold">${item.total_price.toFixed(2)}</td>
                      </tr>
                    ))
                  )}

                  {/* Add item row */}
                  {editMode && showAddItem && (
                    <tr className="bg-blue-50 border-t border-blue-100">
                      <td colSpan={7} className="p-3">
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="flex-1 min-w-48">
                            <label className="text-xs text-gray-500 mb-1 block">Product</label>
                            <select
                              value={newItemProductId}
                              onChange={e => setNewItemProductId(e.target.value)}
                              className="input-field text-sm"
                            >
                              <option value="">— select product —</option>
                              {allProducts.map(p => (
                                <option key={p.id} value={p.id}>{p.sku} — {p.name} (${p.price.toFixed(2)})</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Qty</label>
                            <input type="number" min={1} value={newItemQty} onChange={e => setNewItemQty(Math.max(1, Number(e.target.value)))}
                              className="input-field w-20 text-sm" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Disc%</label>
                            <input type="number" min={0} max={100} value={newItemDiscount} onChange={e => setNewItemDiscount(Number(e.target.value))}
                              className="input-field w-20 text-sm" />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={addItem} disabled={!newItemProductId} className="btn-primary text-sm py-2">Add</button>
                            <button onClick={() => setShowAddItem(false)} className="btn-secondary text-sm py-2">Cancel</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end px-6 py-4 border-t border-gray-100 bg-gray-50">
              <div className="text-right">
                <p className="text-sm text-gray-500">Quote Total</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${(editMode ? editTotal : quote.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          {/* AI Summary */}
          {!editMode && quote.ai_summary && (
            <div className="card border-blue-200">
              <div className="card-header border-blue-100">
                <h2 className="font-semibold text-blue-900">🤖 AI Summary</h2>
              </div>
              <div className="p-5 text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{quote.ai_summary}</div>
            </div>
          )}

          {/* Notes — editable in edit mode */}
          {editMode ? (
            <div className="card">
              <div className="card-header"><h2 className="font-semibold text-gray-900">Notes</h2></div>
              <div className="p-4">
                <textarea
                  value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  className="input-field" rows={4} placeholder="Quote notes…"
                />
              </div>
            </div>
          ) : quote.notes ? (
            <div className="card">
              <div className="card-header"><h2 className="font-semibold text-gray-900">Notes</h2></div>
              <div className="p-5 text-sm text-gray-700 whitespace-pre-wrap">{quote.notes}</div>
            </div>
          ) : null}

          {/* Audit log */}
          <div className="card">
            <div className="card-header">
              <h2 className="font-semibold text-gray-900">Edit History</h2>
            </div>
            <div className="p-4">
              {auditLoading ? (
                <p className="text-sm text-gray-400">Loading history…</p>
              ) : auditEntries.length === 0 ? (
                <p className="text-sm text-gray-400">No edits recorded yet.</p>
              ) : (
                <ol className="space-y-4">
                  {auditEntries.map((entry, i) => (
                    <li key={entry.id} className="flex gap-3">
                      {/* Avatar */}
                      <div className="shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold uppercase">
                        {(entry.display_name || entry.username).charAt(0)}
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900">{entry.display_name || entry.username}</span>
                          <span className="text-xs text-gray-400">
                            {new Date(entry.created_at).toLocaleString()}
                          </span>
                        </div>
                        <ul className="mt-1 space-y-0.5">
                          {(entry.changed_fields as string[]).map(field => (
                            <li key={field} className="text-xs text-gray-600">
                              <span className="font-medium text-gray-700">{FIELD_LABELS[field] || field}:</span>
                              {field === 'line_items' ? (
                                <span className="ml-1">
                                  updated
                                  {entry.old_values.total_amount != null && (
                                    <> (total: <span className="line-through text-gray-400">${Number(entry.old_values.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span> → ${Number(entry.new_values.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })})</>
                                  )}
                                </span>
                              ) : (
                                <span className="ml-1">
                                  <span className="line-through text-gray-400">{fmtValue(field, entry.old_values[field])}</span>
                                  {' → '}
                                  <span className="text-gray-800">{fmtValue(field, entry.new_values[field])}</span>
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {i < auditEntries.length - 1 && (
                        <div className="absolute left-[27px] mt-8 w-px h-full bg-gray-100" aria-hidden />
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Customer info */}
          <div className="card">
            <div className="card-header"><h2 className="font-semibold text-gray-900">Customer</h2></div>
            {editMode ? (
              <div className="p-4 space-y-3">
                {([
                  { key: 'customer_name', label: 'Name', type: 'text' },
                  { key: 'customer_email', label: 'Email', type: 'email' },
                  { key: 'customer_company', label: 'Company', type: 'text' },
                ] as Array<{ key: keyof typeof editForm; label: string; type: string }>).map(({ key, label, type }) => (
                  <div key={key}>
                    <label className="label">{label}</label>
                    <input type={type} value={editForm[key]}
                      onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                      className="input-field" />
                  </div>
                ))}
                <div>
                  <label className="label">Valid Until</label>
                  <input type="date" value={editForm.valid_until}
                    onChange={e => setEditForm(f => ({ ...f, valid_until: e.target.value }))}
                    className="input-field" />
                </div>
              </div>
            ) : (
              <div className="p-5 space-y-3 text-sm">
                {[
                  { label: 'Name', value: quote.customer_name },
                  { label: 'Email', value: quote.customer_email },
                  { label: 'Company', value: quote.customer_company },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-gray-400 font-medium uppercase">{label}</p>
                    <p className="text-gray-900 mt-0.5">{value || '—'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Integrations */}
          <div className="card">
            <div className="card-header"><h2 className="font-semibold text-gray-900">Integrations</h2></div>
            <div className="p-5 space-y-3 text-sm">
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase">HubSpot Deal</p>
                <p className="mt-0.5">
                  {quote.hubspot_deal_id
                    ? <span className="badge-green">ID: {quote.hubspot_deal_id}</span>
                    : <span className="text-gray-400">Not synced</span>}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Convert to Order modal */}
      {showConvertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Convert to Order</h2>
              <button onClick={() => setShowConvertModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Shipping Address</label>
                <textarea value={shippingAddress} onChange={e => setShippingAddress(e.target.value)}
                  className="input-field" rows={3} placeholder="Enter shipping address…" />
              </div>
              <div>
                <label className="label">Order Notes</label>
                <textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)}
                  className="input-field" rows={2} placeholder="Special instructions…" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={syncHubSpot} onChange={e => setSyncHubSpot(e.target.checked)} className="w-4 h-4 text-blue-600" />
                <span className="text-sm">Create HubSpot deal for this order</span>
              </label>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowConvertModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleConvertToOrder} disabled={converting} className="btn-primary">
                {converting ? 'Converting…' : 'Create Order →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
