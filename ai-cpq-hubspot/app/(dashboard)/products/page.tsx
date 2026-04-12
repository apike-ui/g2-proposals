'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Product } from '@/lib/supabase'

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [form, setForm] = useState({ sku: '', name: '', description: '', price: '', category: '', unit: 'each' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    const res = await fetch(`/api/products?${params}`)
    const data = await res.json()
    setProducts(data.products || [])
    setLoading(false)
  }, [search])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  function openCreate() {
    setEditingProduct(null)
    setForm({ sku: '', name: '', description: '', price: '', category: '', unit: 'each' })
    setError('')
    setShowModal(true)
  }

  function openEdit(product: Product) {
    setEditingProduct(product)
    setForm({
      sku: product.sku,
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      category: product.category || '',
      unit: product.unit || 'each',
    })
    setError('')
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.sku || !form.name) {
      setError('SKU and Name are required')
      return
    }
    setSaving(true)
    setError('')

    const body = {
      sku: form.sku,
      name: form.name,
      description: form.description || null,
      price: parseFloat(form.price) || 0,
      category: form.category || null,
      unit: form.unit || 'each',
    }

    const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products'
    const method = editingProduct ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Save failed')
    } else {
      setShowModal(false)
      setSuccess(editingProduct ? 'Product updated' : 'Product created')
      fetchProducts()
      setTimeout(() => setSuccess(''), 3000)
    }
    setSaving(false)
  }

  async function handleDelete(product: Product) {
    if (!confirm(`Delete "${product.name}" (${product.sku})?`)) return
    const res = await fetch(`/api/products/${product.id}`, { method: 'DELETE' })
    if (res.ok) {
      setSuccess('Product deleted')
      fetchProducts()
      setTimeout(() => setSuccess(''), 3000)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-500 mt-0.5 text-sm">{products.length} SKUs in catalog</p>
        </div>
        <div className="flex gap-3">
          <Link href="/upload" className="btn-secondary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Import Excel
          </Link>
          <button onClick={openCreate} className="btn-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Product
          </button>
        </div>
      </div>

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {success}
        </div>
      )}

      {/* Search */}
      <div className="card mb-4">
        <div className="p-4">
          <input
            type="text"
            placeholder="Search by SKU, name, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-header">SKU</th>
                <th className="table-header">Name</th>
                <th className="table-header">Description</th>
                <th className="table-header">Price</th>
                <th className="table-header">Category</th>
                <th className="table-header">Unit</th>
                <th className="table-header">HubSpot</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="table-cell text-center text-gray-400 py-12">Loading products...</td></tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table-cell text-center py-16">
                    <div className="text-gray-400">
                      <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      <p className="font-medium">No products found</p>
                      <p className="text-sm mt-1">
                        <button onClick={openCreate} className="text-blue-600 hover:underline">Add manually</button>
                        {' '}or{' '}
                        <Link href="/upload" className="text-blue-600 hover:underline">import from Excel</Link>
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="table-row">
                    <td className="table-cell font-mono text-xs font-semibold text-blue-700 bg-blue-50/30">{product.sku}</td>
                    <td className="table-cell font-medium">{product.name}</td>
                    <td className="table-cell text-gray-500 max-w-xs truncate">{product.description || '—'}</td>
                    <td className="table-cell font-semibold">${product.price.toFixed(2)}</td>
                    <td className="table-cell">
                      {product.category
                        ? <span className="badge-blue">{product.category}</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="table-cell text-gray-500">{product.unit}</td>
                    <td className="table-cell">
                      {product.hubspot_product_id
                        ? <span className="badge-green">Synced</span>
                        : <span className="badge-gray">Not synced</span>}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(product)}
                          className="text-gray-600 hover:text-blue-600 transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(product)}
                          className="text-gray-600 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 text-lg">
                {editingProduct ? 'Edit Product' : 'Add Product'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">SKU *</label>
                  <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    className="input-field" placeholder="e.g. SKU-001" disabled={!!editingProduct} />
                </div>
                <div>
                  <label className="label">Unit</label>
                  <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="input-field">
                    {['each', 'license', 'license/year', 'hour', 'day', 'month', 'year', 'seat', 'GB', 'TB'].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input-field" placeholder="Product name" />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="input-field" rows={3} placeholder="Product description" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Price ($)</label>
                  <input type="number" step="0.01" min="0" value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="input-field" placeholder="0.00" />
                </div>
                <div>
                  <label className="label">Category</label>
                  <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="input-field" placeholder="e.g. Software" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? 'Saving...' : 'Save Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
