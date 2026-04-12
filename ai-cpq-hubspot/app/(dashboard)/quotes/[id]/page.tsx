'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Quote } from '@/lib/supabase'

const statusColors: Record<string, string> = {
  draft: 'badge-gray', sent: 'badge-blue', accepted: 'badge-green',
  rejected: 'badge-red', expired: 'badge-yellow',
}

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

  const fetchQuote = useCallback(async () => {
    const res = await fetch(`/api/quotes/${id}`)
    const data = await res.json()
    setQuote(data.quote)
    setLoading(false)
  }, [id])

  useEffect(() => { fetchQuote() }, [fetchQuote])

  async function updateStatus(status: string) {
    await fetch(`/api/quotes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    fetchQuote()
  }

  async function generateAISummary() {
    if (!quote) return
    setGeneratingAI(true)
    setMessage('')
    try {
      const res = await fetch(`/api/quotes/${id}/ai-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: quote.customer_name,
          customerCompany: quote.customer_company,
          items: quote.items?.map(i => ({
            productName: i.product?.name,
            sku: i.product?.sku,
            quantity: i.quantity,
            unitPrice: i.unit_price,
            totalPrice: i.total_price,
          })),
          total: quote.total_amount,
          notes: quote.notes,
        }),
      })
      const data = await res.json()
      if (data.summary) {
        await fetch(`/api/quotes/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aiSummary: data.summary }),
        })
        fetchQuote()
      }
    } catch {
      setMessage('AI summary generation failed')
    } finally {
      setGeneratingAI(false)
    }
  }

  async function handleConvertToOrder() {
    setConverting(true)
    try {
      const res = await fetch(`/api/quotes/${id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shippingAddress, notes: orderNotes, syncToHubSpot: syncHubSpot }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push(`/orders/${data.order.id}`)
      } else {
        setMessage(data.error || 'Conversion failed')
        setConverting(false)
      }
    } catch {
      setMessage('Conversion failed')
      setConverting(false)
    }
  }

  async function syncToHubSpotDeal() {
    if (!quote) return
    setSyncing(true)
    try {
      const res = await fetch('/api/hubspot/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealname: `${quote.quote_number} - ${quote.customer_company || quote.customer_name || 'Deal'}`,
          amount: quote.total_amount,
        }),
      })
      const data = await res.json()
      if (data.dealId) {
        await fetch(`/api/quotes/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hubspotDealId: data.dealId }),
        })
        fetchQuote()
        setMessage('Synced to HubSpot!')
      }
    } catch {
      setMessage('HubSpot sync failed')
    } finally {
      setSyncing(false)
      setTimeout(() => setMessage(''), 3000)
    }
  }

  async function generatePDF() {
    if (!quote) return
    setGeneratingPDF(true)
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF()

      // Header
      doc.setFillColor(37, 99, 235)
      doc.rect(0, 0, 210, 40, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(22)
      doc.setFont('helvetica', 'bold')
      doc.text('QUOTE', 15, 20)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.text(quote.quote_number, 15, 30)

      // Customer info
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('Bill To:', 15, 55)
      doc.setFont('helvetica', 'normal')
      doc.text(quote.customer_name || '', 15, 63)
      doc.text(quote.customer_company || '', 15, 70)
      doc.text(quote.customer_email || '', 15, 77)

      // Quote details
      doc.setFont('helvetica', 'bold')
      doc.text('Quote Details:', 130, 55)
      doc.setFont('helvetica', 'normal')
      doc.text(`Date: ${new Date(quote.created_at).toLocaleDateString()}`, 130, 63)
      if (quote.valid_until) doc.text(`Valid Until: ${new Date(quote.valid_until).toLocaleDateString()}`, 130, 70)
      doc.text(`Status: ${quote.status.toUpperCase()}`, 130, 77)

      // Line items table
      const tableData = (quote.items || []).map(item => [
        item.product?.sku || '',
        item.product?.name || '',
        item.quantity.toString(),
        `$${item.unit_price.toFixed(2)}`,
        item.discount_percent > 0 ? `${item.discount_percent}%` : '—',
        `$${item.total_price.toFixed(2)}`,
      ])

      autoTable(doc, {
        startY: 90,
        head: [['SKU', 'Product', 'Qty', 'Unit Price', 'Discount', 'Total']],
        body: tableData,
        headStyles: { fillColor: [37, 99, 235] },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 15, right: 15 },
      })

      const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

      // Total
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.text(`Total: $${quote.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 140, finalY)

      // AI Summary
      if (quote.ai_summary) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.text('Summary:', 15, finalY + 20)
        doc.setFont('helvetica', 'normal')
        const lines = doc.splitTextToSize(quote.ai_summary, 180)
        doc.text(lines, 15, finalY + 28)
      }

      // Notes
      if (quote.notes) {
        const notesY = quote.ai_summary ? finalY + 60 : finalY + 20
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.text('Notes:', 15, notesY)
        doc.setFont('helvetica', 'normal')
        const lines = doc.splitTextToSize(quote.notes, 180)
        doc.text(lines, 15, notesY + 8)
      }

      doc.save(`${quote.quote_number}.pdf`)
    } catch (e) {
      setMessage('PDF generation failed')
    } finally {
      setGeneratingPDF(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-center text-gray-400">Loading quote...</div>
  }

  if (!quote) {
    return <div className="p-6 text-center text-gray-400">Quote not found. <Link href="/quotes" className="text-blue-600">Back to quotes</Link></div>
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/quotes" className="text-gray-400 hover:text-gray-600">← Quotes</Link>
            <span className="font-mono font-bold text-xl text-gray-900">{quote.quote_number}</span>
            <span className={statusColors[quote.status] || 'badge-gray'}>{quote.status}</span>
          </div>
          <p className="text-gray-500 text-sm mt-1">
            Created {new Date(quote.created_at).toLocaleDateString()}
            {quote.valid_until && ` · Valid until ${new Date(quote.valid_until).toLocaleDateString()}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={quote.status}
            onChange={(e) => updateStatus(e.target.value)}
            className="input-field w-auto text-sm"
          >
            {['draft', 'sent', 'accepted', 'rejected', 'expired'].map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <button onClick={generatePDF} disabled={generatingPDF} className="btn-secondary">
            {generatingPDF ? 'Generating...' : '📄 PDF'}
          </button>
          <button onClick={generateAISummary} disabled={generatingAI} className="btn-secondary">
            {generatingAI ? 'Generating...' : '🤖 AI Summary'}
          </button>
          {!quote.hubspot_deal_id && (
            <button onClick={syncToHubSpotDeal} disabled={syncing} className="btn-secondary">
              {syncing ? 'Syncing...' : '⚡ HubSpot'}
            </button>
          )}
          <button
            onClick={() => setShowConvertModal(true)}
            disabled={quote.status === 'accepted'}
            className="btn-primary"
          >
            Convert to Order →
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">{message}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line Items */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card overflow-hidden">
            <div className="card-header">
              <h2 className="font-semibold text-gray-900">Line Items</h2>
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
                  </tr>
                </thead>
                <tbody>
                  {(quote.items || []).map((item) => (
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
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end px-6 py-4 border-t border-gray-100 bg-gray-50">
              <div className="text-right">
                <p className="text-sm text-gray-500">Quote Total</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${quote.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          {/* AI Summary */}
          {quote.ai_summary && (
            <div className="card border-blue-200">
              <div className="card-header border-blue-100">
                <h2 className="font-semibold text-blue-900 flex items-center gap-2">
                  🤖 AI Summary
                </h2>
              </div>
              <div className="p-5 text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                {quote.ai_summary}
              </div>
            </div>
          )}

          {/* Notes */}
          {quote.notes && (
            <div className="card">
              <div className="card-header"><h2 className="font-semibold text-gray-900">Notes</h2></div>
              <div className="p-5 text-sm text-gray-700 whitespace-pre-wrap">{quote.notes}</div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          <div className="card">
            <div className="card-header"><h2 className="font-semibold text-gray-900">Customer</h2></div>
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
          </div>

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

      {/* Convert to Order Modal */}
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
                  className="input-field" rows={3} placeholder="Enter shipping address..." />
              </div>
              <div>
                <label className="label">Order Notes</label>
                <textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)}
                  className="input-field" rows={2} placeholder="Special instructions..." />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={syncHubSpot} onChange={e => setSyncHubSpot(e.target.checked)}
                  className="w-4 h-4 text-blue-600" />
                <span className="text-sm">Create HubSpot deal for this order</span>
              </label>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowConvertModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleConvertToOrder} disabled={converting} className="btn-primary">
                {converting ? 'Converting...' : 'Create Order →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
