'use client'

import { useEffect, useState } from 'react'

interface SyncResult {
  synced: number
  errors: string[]
}

export default function HubSpotPage() {
  const [products, setProducts] = useState<Array<{ id: string; sku: string; name: string; hubspot_product_id: string | null }>>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [contacts, setContacts] = useState<Array<{ id: string; firstName: string; lastName: string; email: string; company: string }>>([])
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [error, setError] = useState('')
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then(d => { setProducts(d.products || []); setLoading(false) })
  }, [])

  async function syncProducts() {
    setSyncing(true)
    setError('')
    setSyncResult(null)

    try {
      const res = await fetch('/api/hubspot/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: selectedProducts.length > 0 ? selectedProducts : undefined }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Sync failed')
      } else {
        setSyncResult(data)
        setSelectedProducts([])
        const res2 = await fetch('/api/products')
        const data2 = await res2.json()
        setProducts(data2.products || [])
      }
    } catch {
      setError('Network error during sync')
    } finally {
      setSyncing(false)
    }
  }

  async function loadContacts() {
    setLoadingContacts(true)
    setError('')
    try {
      const res = await fetch('/api/hubspot/contacts')
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to load contacts')
      } else {
        setContacts(data.contacts || [])
      }
    } catch {
      setError('Failed to connect to HubSpot')
    } finally {
      setLoadingContacts(false)
    }
  }

  function toggleProduct(id: string) {
    setSelectedProducts(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id],
    )
  }

  const syncedCount = products.filter(p => p.hubspot_product_id).length
  const unsyncedCount = products.length - syncedCount

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">HubSpot Integration</h1>
        <p className="text-gray-500 mt-1 text-sm">Sync your product catalog and access CRM contacts</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm font-medium">Error</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <p className="text-red-500 text-xs mt-2">
            Make sure HUBSPOT_ACCESS_TOKEN is configured in your .env.local file.
          </p>
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-5 text-center">
          <p className="text-3xl font-bold text-gray-900">{products.length}</p>
          <p className="text-sm text-gray-500 mt-1">Total Products</p>
        </div>
        <div className="card p-5 text-center border-green-200">
          <p className="text-3xl font-bold text-green-600">{syncedCount}</p>
          <p className="text-sm text-gray-500 mt-1">Synced to HubSpot</p>
        </div>
        <div className="card p-5 text-center border-orange-200">
          <p className="text-3xl font-bold text-orange-600">{unsyncedCount}</p>
          <p className="text-sm text-gray-500 mt-1">Not Synced</p>
        </div>
      </div>

      {/* Sync Result */}
      {syncResult && (
        <div className={`mb-6 p-4 rounded-xl border-2 ${syncResult.errors.length === 0 ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}>
          <p className="font-semibold text-gray-900 mb-2">
            {syncResult.errors.length === 0 ? '✅ Sync Complete' : '⚠️ Sync Completed with Errors'}
          </p>
          <p className="text-sm text-gray-700">Successfully synced: <strong>{syncResult.synced}</strong> products</p>
          {syncResult.errors.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-medium text-red-800">Errors:</p>
              <ul className="mt-1 space-y-1">
                {syncResult.errors.map((e, i) => (
                  <li key={i} className="text-xs text-red-700">{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Products Sync */}
      <div className="card mb-6">
        <div className="card-header">
          <h2 className="font-semibold text-gray-900">Product Catalog Sync</h2>
          <div className="flex gap-2">
            {selectedProducts.length > 0 && (
              <button onClick={() => setSelectedProducts([])} className="btn-secondary btn-sm">
                Clear ({selectedProducts.length})
              </button>
            )}
            <button onClick={syncProducts} disabled={syncing || loading} className="btn-primary btn-sm">
              {syncing ? (
                <><svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>Syncing...</>
              ) : selectedProducts.length > 0
                ? `Sync ${selectedProducts.length} Selected`
                : 'Sync All Products'}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-header w-10">
                  <input type="checkbox"
                    checked={selectedProducts.length === products.filter(p => !p.hubspot_product_id).length && products.filter(p => !p.hubspot_product_id).length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedProducts(products.filter(p => !p.hubspot_product_id).map(p => p.id))
                      } else {
                        setSelectedProducts([])
                      }
                    }}
                    className="w-4 h-4"
                  />
                </th>
                <th className="table-header">SKU</th>
                <th className="table-header">Name</th>
                <th className="table-header">HubSpot Status</th>
                <th className="table-header">HubSpot ID</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="table-cell text-center py-8 text-gray-400">Loading...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={5} className="table-cell text-center py-8 text-gray-400">No products. Import some first.</td></tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="table-row">
                    <td className="table-cell">
                      <input type="checkbox"
                        checked={selectedProducts.includes(p.id)}
                        onChange={() => toggleProduct(p.id)}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="table-cell font-mono text-xs text-blue-700">{p.sku}</td>
                    <td className="table-cell font-medium">{p.name}</td>
                    <td className="table-cell">
                      {p.hubspot_product_id
                        ? <span className="badge-green">✓ Synced</span>
                        : <span className="badge-yellow">Not synced</span>}
                    </td>
                    <td className="table-cell text-xs text-gray-500 font-mono">
                      {p.hubspot_product_id || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* HubSpot Contacts */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-gray-900">CRM Contacts</h2>
          <button onClick={loadContacts} disabled={loadingContacts} className="btn-secondary btn-sm">
            {loadingContacts ? 'Loading...' : contacts.length > 0 ? 'Refresh' : 'Load Contacts'}
          </button>
        </div>
        {contacts.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <svg className="w-10 h-10 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm">Click &quot;Load Contacts&quot; to pull from HubSpot CRM</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Name</th>
                  <th className="table-header">Email</th>
                  <th className="table-header">Company</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id} className="table-row">
                    <td className="table-cell font-medium">{c.firstName} {c.lastName}</td>
                    <td className="table-cell text-gray-500">{c.email || '—'}</td>
                    <td className="table-cell text-gray-500">{c.company || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Setup Instructions */}
      <div className="mt-6 card bg-blue-50 border-blue-200">
        <div className="p-5">
          <h3 className="font-semibold text-blue-900 mb-3">HubSpot Setup</h3>
          <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
            <li>Go to <strong>HubSpot → Settings → Integrations → Private Apps</strong></li>
            <li>Create a new Private App with these scopes:
              <ul className="ml-5 mt-1 space-y-1 text-blue-700 list-disc">
                <li><code className="bg-blue-100 px-1 rounded">crm.objects.contacts.read</code></li>
                <li><code className="bg-blue-100 px-1 rounded">crm.objects.deals.write</code></li>
                <li><code className="bg-blue-100 px-1 rounded">crm.objects.products.write</code></li>
                <li><code className="bg-blue-100 px-1 rounded">crm.objects.products.read</code></li>
              </ul>
            </li>
            <li>Copy the access token and add it to your <code className="bg-blue-100 px-1 rounded">.env.local</code> as <code className="bg-blue-100 px-1 rounded">HUBSPOT_ACCESS_TOKEN</code></li>
          </ol>
        </div>
      </div>
    </div>
  )
}
