'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Product } from '@/lib/supabase'

interface LineItem {
  product_id: string
  product: Product | null
  quantity: number
  unit_price: number
  discount_percent: number
  total_price: number
  notes: string
}

interface AISuggestion {
  sku: string
  name: string
  reason: string
  quantity: number
}

export default function NewQuotePage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [items, setItems] = useState<LineItem[]>([])
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerCompany, setCustomerCompany] = useState('')
  const [notes, setNotes] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [showProductPicker, setShowProductPicker] = useState(false)
  const [aiRequirement, setAiRequirement] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([])
  const [aiSummary, setAiSummary] = useState('')
  const [hubspotContacts, setHubspotContacts] = useState<Array<{ id: string; firstName: string; lastName: string; email: string; company: string }>>([])
  const [showContacts, setShowContacts] = useState(false)

  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(d => setProducts(d.products || []))
  }, [])

  const filteredProducts = products.filter(p =>
    productSearch === '' ||
    p.sku.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.name.toLowerCase().includes(productSearch.toLowerCase()),
  )

  function addProduct(product: Product) {
    const existing = items.find(i => i.product_id === product.id)
    if (existing) {
      setItems(items.map(i => i.product_id === product.id
        ? { ...i, quantity: i.quantity + 1, total_price: (i.quantity + 1) * i.unit_price * (1 - i.discount_percent / 100) }
        : i,
      ))
    } else {
      setItems([...items, {
        product_id: product.id,
        product,
        quantity: 1,
        unit_price: product.price,
        discount_percent: 0,
        total_price: product.price,
        notes: '',
      }])
    }
    setProductSearch('')
    setShowProductPicker(false)
  }

  function updateItem(index: number, field: keyof LineItem, value: unknown) {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    // Recalculate total
    const { quantity, unit_price, discount_percent } = updated[index]
    updated[index].total_price = quantity * unit_price * (1 - (discount_percent || 0) / 100)
    setItems(updated)
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index))
  }

  const subtotal = items.reduce((sum, i) => sum + i.total_price, 0)

  async function handleAISuggest() {
    if (!aiRequirement.trim()) return
    setAiLoading(true)
    setAiSuggestions([])
    setAiSummary('')

    try {
      const res = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirement: aiRequirement }),
      })
      const data = await res.json()
      setAiSuggestions(data.suggestions || [])
      setAiSummary(data.summary || '')
    } catch {
      setAiSummary('AI suggestion failed. Please try again.')
    } finally {
      setAiLoading(false)
    }
  }

  function addAISuggestion(suggestion: AISuggestion) {
    const product = products.find(p => p.sku === suggestion.sku)
    if (product) {
      const existing = items.find(i => i.product_id === product.id)
      if (!existing) {
        const qty = suggestion.quantity || 1
        setItems([...items, {
          product_id: product.id,
          product,
          quantity: qty,
          unit_price: product.price,
          discount_percent: 0,
          total_price: qty * product.price,
          notes: suggestion.reason,
        }])
      }
    }
  }

  async function loadHubSpotContacts() {
    setShowContacts(true)
    if (hubspotContacts.length > 0) return
    try {
      const res = await fetch('/api/hubspot/contacts')
      const data = await res.json()
      setHubspotContacts(data.contacts || [])
    } catch {
      setShowContacts(false)
    }
  }

  async function handleSave() {
    if (items.length === 0) {
      setError('Please add at least one product to the quote')
      return
    }
    setSaving(true)
    setError('')

    const res = await fetch('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName, customerEmail, customerCompany, notes, validUntil,
        items: items.map(i => ({
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          discount_percent: i.discount_percent,
          total_price: i.total_price,
          notes: i.notes,
        })),
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Failed to create quote')
      setSaving(false)
    } else {
      router.push(`/quotes/${data.quote.id}`)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">New Quote</h1>
        <p className="text-gray-500 mt-1 text-sm">Configure products and pricing for your customer</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Main form */}
        <div className="lg:col-span-2 space-y-6">

          {/* AI Assistant */}
          <div className="card border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
            <div className="card-header border-blue-100">
              <div className="flex items-center gap-2">
                <span className="text-lg">🤖</span>
                <h2 className="font-semibold text-blue-900">AI Product Suggestion</h2>
              </div>
              <span className="badge-blue">Powered by Claude</span>
            </div>
            <div className="p-5">
              <textarea
                value={aiRequirement}
                onChange={(e) => setAiRequirement(e.target.value)}
                placeholder="Describe what the customer needs... e.g. 'Customer needs a 50-user software deployment with training and annual support'"
                className="input-field mb-3"
                rows={3}
              />
              <button onClick={handleAISuggest} disabled={aiLoading || !aiRequirement.trim()} className="btn-primary btn-sm">
                {aiLoading ? (
                  <><svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg> Thinking...</>
                ) : '✨ Suggest Products'}
              </button>

              {aiSummary && (
                <div className="mt-4 p-3 bg-white rounded-lg border border-blue-200 text-sm text-gray-700">
                  {aiSummary}
                </div>
              )}

              {aiSuggestions.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-semibold text-blue-800">Suggested Products:</p>
                  {aiSuggestions.map((s, i) => {
                    const inQuote = items.some(item => item.product?.sku === s.sku)
                    return (
                      <div key={i} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-blue-100">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm">{s.name}</p>
                          <p className="text-xs text-gray-500 font-mono">{s.sku}</p>
                          <p className="text-xs text-gray-600 mt-1">{s.reason}</p>
                        </div>
                        <button
                          onClick={() => addAISuggestion(s)}
                          disabled={inQuote}
                          className={inQuote ? 'btn-secondary btn-sm opacity-50' : 'btn-primary btn-sm'}
                        >
                          {inQuote ? 'Added' : '+ Add'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="card">
            <div className="card-header">
              <h2 className="font-semibold text-gray-900">Line Items</h2>
              <div className="relative">
                <button onClick={() => setShowProductPicker(!showProductPicker)} className="btn-primary btn-sm">
                  + Add Product
                </button>
                {showProductPicker && (
                  <div className="absolute right-0 top-10 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50">
                    <div className="p-3 border-b border-gray-100">
                      <input
                        type="text"
                        placeholder="Search products..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="input-field"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {filteredProducts.length === 0 ? (
                        <p className="text-center text-gray-400 py-6 text-sm">No products found</p>
                      ) : (
                        filteredProducts.map(p => (
                          <button key={p.id} onClick={() => addProduct(p)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 text-left border-b border-gray-50">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 text-sm truncate">{p.name}</p>
                              <p className="text-xs text-gray-500 font-mono">{p.sku}</p>
                            </div>
                            <p className="text-sm font-semibold text-gray-700 flex-shrink-0">${p.price.toFixed(2)}</p>
                          </button>
                        ))
                      )}
                    </div>
                    <div className="p-2 border-t border-gray-100">
                      <button onClick={() => setShowProductPicker(false)} className="btn-secondary btn-sm w-full justify-center">Close</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {items.length === 0 ? (
              <div className="p-10 text-center text-gray-400">
                <p className="text-sm">No products added yet. Use AI suggestions or click &quot;Add Product&quot;.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="table-header">Product</th>
                      <th className="table-header w-24">Qty</th>
                      <th className="table-header w-28">Unit Price</th>
                      <th className="table-header w-24">Disc %</th>
                      <th className="table-header w-28">Total</th>
                      <th className="table-header w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-sm">{item.product?.name}</p>
                          <p className="text-xs text-gray-500 font-mono">{item.product?.sku}</p>
                          <input
                            type="text"
                            value={item.notes}
                            onChange={(e) => updateItem(i, 'notes', e.target.value)}
                            placeholder="Note (optional)"
                            className="mt-1 w-full text-xs px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input type="number" min="1" value={item.quantity}
                            onChange={(e) => updateItem(i, 'quantity', parseInt(e.target.value) || 1)}
                            className="w-20 text-sm px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-center" />
                        </td>
                        <td className="px-4 py-3">
                          <input type="number" min="0" step="0.01" value={item.unit_price}
                            onChange={(e) => updateItem(i, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="w-24 text-sm px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        </td>
                        <td className="px-4 py-3">
                          <input type="number" min="0" max="100" step="0.5" value={item.discount_percent}
                            onChange={(e) => updateItem(i, 'discount_percent', parseFloat(e.target.value) || 0)}
                            className="w-20 text-sm px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        </td>
                        <td className="px-4 py-3 font-semibold text-sm">
                          ${item.total_price.toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => removeItem(i)} className="text-gray-400 hover:text-red-500">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {items.length > 0 && (
              <div className="flex justify-end px-6 py-4 border-t border-gray-100 bg-gray-50">
                <div className="text-right">
                  <p className="text-sm text-gray-500">Total</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Customer info + actions */}
        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <h2 className="font-semibold text-gray-900">Customer</h2>
              <button onClick={loadHubSpotContacts} className="btn-secondary btn-sm">
                From HubSpot
              </button>
            </div>
            <div className="p-5 space-y-4">
              {showContacts && (
                <div className="mb-4">
                  {hubspotContacts.length === 0 ? (
                    <p className="text-sm text-gray-400">Loading contacts...</p>
                  ) : (
                    <select
                      className="input-field"
                      onChange={(e) => {
                        const contact = hubspotContacts.find(c => c.id === e.target.value)
                        if (contact) {
                          setCustomerName(`${contact.firstName} ${contact.lastName}`.trim())
                          setCustomerEmail(contact.email)
                          setCustomerCompany(contact.company)
                          setShowContacts(false)
                        }
                      }}
                    >
                      <option value="">Select a contact...</option>
                      {hubspotContacts.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.firstName} {c.lastName} — {c.company}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              <div>
                <label className="label">Name</label>
                <input value={customerName} onChange={e => setCustomerName(e.target.value)}
                  className="input-field" placeholder="John Smith" />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)}
                  className="input-field" placeholder="john@company.com" />
              </div>
              <div>
                <label className="label">Company</label>
                <input value={customerCompany} onChange={e => setCustomerCompany(e.target.value)}
                  className="input-field" placeholder="Acme Corp" />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="font-semibold text-gray-900">Details</h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Valid Until</label>
                <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
                  className="input-field" />
              </div>
              <div>
                <label className="label">Internal Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  className="input-field" rows={4} placeholder="Notes, terms, or special conditions..." />
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="card bg-gray-900 text-white border-0">
            <div className="p-5">
              <div className="flex justify-between mb-2">
                <span className="text-gray-400 text-sm">Items</span>
                <span className="font-medium">{items.length}</span>
              </div>
              <div className="flex justify-between mb-4">
                <span className="text-gray-400 text-sm">Quote Total</span>
                <span className="font-bold text-xl">${subtotal.toFixed(2)}</span>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-900/50 rounded-lg text-red-300 text-sm">{error}</div>
              )}

              <button onClick={handleSave} disabled={saving} className="btn-primary w-full justify-center py-3">
                {saving ? 'Creating...' : 'Create Quote →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
