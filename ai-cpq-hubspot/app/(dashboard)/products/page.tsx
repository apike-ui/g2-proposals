'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface Product {
  id: string; sku: string; name: string; description?: string
  price: number; category?: string; unit?: string
  hubspot_product_id?: string; batch_id?: string; created_at?: string
}
interface Batch { id: string; filename: string; created_at: string }

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'all' | 'batch'>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState({ sku: '', name: '', description: '', price: '', category: '', unit: 'each' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState({ text: '', ok: true })
  const [isAdmin, setIsAdmin] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.role) setIsAdmin(!d.role || d.role === 'admin')
    }).catch(() => {})
    fetch('/api/products/batches').then(r => r.json()).then(d => setBatches(d.batches || [])).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    const res = await fetch(`/api/products?${p}`)
    const data = await res.json()
    setProducts(data.products || [])
    setLoading(false)
  }, [search])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null)
    setForm({ sku: '', name: '', description: '', price: '', category: '', unit: 'each' })
    setMsg({ text: '', ok: true })
    setShowModal(true)
  }
  function openEdit(p: Product) {
    setEditing(p)
    setForm({ sku: p.sku, name: p.name, description: p.description || '', price: String(p.price), category: p.category || '', unit: p.unit || 'each' })
    setMsg({ text: '', ok: true })
    setShowModal(true)
  }
  async function save() {
    if (!form.sku || !form.name) { setMsg({ text: 'SKU and Name are required', ok: false }); return }
    setSaving(true)
    const body = { sku: form.sku, name: form.name, description: form.description || null, price: parseFloat(form.price) || 0, category: form.category || null, unit: form.unit }
    const res = await fetch(editing ? `/api/products/${editing.id}` : '/api/products', {
      method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) { setMsg({ text: data.error || 'Save failed', ok: false }) }
    else { setShowModal(false); load(); setMsg({ text: editing ? 'Updated' : 'Created', ok: true }) }
    setSaving(false)
  }
  async function del(p: Product) {
    if (!confirm(`Delete "${p.name}"?`)) return
    await fetch(`/api/products/${p.id}`, { method: 'DELETE' })
    load()
  }
  function toggleBatch(id: string) {
    setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  const grouped = viewMode === 'batch' ? {
    batches: batches.map(b => ({ batch: b, items: products.filter(p => p.batch_id === b.id) })),
    manual: products.filter(p => !p.batch_id),
  } : null

  const ProductRow = ({ p }: { p: Product }) => (
    <tr className="table-row">
      <td className="table-cell font-mono text-xs font-semibold text-blue-700">{p.sku}</td>
      <td className="table-cell font-medium">{p.name}</td>
      <td className="table-cell text-gray-500 max-w-xs truncate">{p.description || '—'}</td>
      <td className="table-cell font-semibold">${p.price.toFixed(2)}</td>
      <td className="table-cell">{p.category ? <span className="badge-blue">{p.category}</span> : '—'}</td>
      <td className="table-cell text-gray-500">{p.unit}</td>
      {isAdmin && (
        <td className="table-cell">
          <div className="flex gap-2">
            <button onClick={() => openEdit(p)} className="text-gray-500 hover:text-blue-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
            <button onClick={() => del(p)} className="text-gray-500 hover:text-red-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        </td>
      )}
    </tr>
  )

  const TableHead = () => (
    <thead className="bg-gray-50 border-b border-gray-100">
      <tr>
        <th className="table-header">SKU</th>
        <th className="table-header">Name</th>
        <th className="table-header">Description</th>
        <th className="table-header">Price</th>
        <th className="table-header">Category</th>
        <th className="table-header">Unit</th>
        {isAdmin && <th className="table-header">Actions</th>}
      </tr>
    </thead>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-500 text-sm mt-0.5">{products.length} SKUs in catalog</p>
        </div>
        {isAdmin && (
          <div className="flex gap-3">
            <Link href="/upload" className="btn-secondary">Import Excel</Link>
            <button onClick={openCreate} className="btn-primary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add SKU
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-3 mb-4">
        <input type="text" placeholder="Search SKU, name, description..." value={search}
          onChange={e => setSearch(e.target.value)} className="input-field flex-1" />
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {(['all', 'batch'] as const).map(m => (
            <button key={m} onClick={() => setViewMode(m)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${viewMode === m ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              {m === 'all' ? 'All SKUs' : 'By Upload'}
            </button>
          ))}
        </div>
      </div>

      {viewMode === 'all' ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <TableHead />
              <tbody>
                {loading ? (
                  <tr><td colSpan={isAdmin ? 7 : 6} className="table-cell text-center py-12 text-gray-400">Loading...</td></tr>
                ) : products.length === 0 ? (
                  <tr><td colSpan={isAdmin ? 7 : 6} className="table-cell text-center py-12 text-gray-400">No products found</td></tr>
                ) : products.map(p => <ProductRow key={p.id} p={p} />)}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped?.batches.map(({ batch, items }) => (
            <div key={batch.id} className="card overflow-hidden">
              <button onClick={() => toggleBatch(batch.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded.has(batch.id) ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">{batch.filename}</p>
                    <p className="text-xs text-gray-400">{new Date(batch.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <span className="badge-blue">{items.length} SKUs</span>
              </button>
              {expanded.has(batch.id) && (
                <div className="overflow-x-auto border-t border-gray-100">
                  <table className="w-full"><TableHead />
                    <tbody>{items.length === 0 ? (
                      <tr><td colSpan={isAdmin ? 7 : 6} className="table-cell text-center py-6 text-gray-400">No SKUs in this batch</td></tr>
                    ) : items.map(p => <ProductRow key={p.id} p={p} />)}</tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
          {(grouped?.manual.length ?? 0) > 0 && (
            <div className="card overflow-hidden">
              <button onClick={() => toggleBatch('manual')}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded.has('manual') ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  <p className="font-medium text-gray-900">Manually Added</p>
                </div>
                <span className="badge-gray">{grouped?.manual.length} SKUs</span>
              </button>
              {expanded.has('manual') && (
                <div className="overflow-x-auto border-t border-gray-100">
                  <table className="w-full"><TableHead />
                    <tbody>{grouped?.manual.map(p => <ProductRow key={p.id} p={p} />)}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          {batches.length === 0 && products.length === 0 && (
            <div className="card p-12 text-center text-gray-400">No products yet. <Link href="/upload" className="text-blue-600 hover:underline">Import from Excel</Link> or <button onClick={openCreate} className="text-blue-600 hover:underline">add manually</button>.</div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 text-lg">{editing ? 'Edit SKU' : 'Add SKU'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {msg.text && <div className={`p-3 rounded-lg text-sm ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">SKU *</label><input className="input-field" value={form.sku} onChange={e => setForm(f => ({...f, sku: e.target.value}))} disabled={!!editing} /></div>
                <div><label className="label">Unit</label>
                  <select className="input-field" value={form.unit} onChange={e => setForm(f => ({...f, unit: e.target.value}))}>
                    {['each','license','license/year','hour','day','month','year','seat','GB','TB'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="label">Name *</label><input className="input-field" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} /></div>
              <div><label className="label">Description</label><textarea className="input-field" rows={2} value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Price ($)</label><input type="number" step="0.01" className="input-field" value={form.price} onChange={e => setForm(f => ({...f, price: e.target.value}))} /></div>
                <div><label className="label">Category</label><input className="input-field" value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))} /></div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save SKU'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
