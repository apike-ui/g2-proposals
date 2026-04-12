'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Quote } from '@/lib/supabase'

const statusColors: Record<string, string> = {
  draft: 'badge-gray',
  sent: 'badge-blue',
  accepted: 'badge-green',
  rejected: 'badge-red',
  expired: 'badge-yellow',
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const fetchQuotes = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (statusFilter) params.set('status', statusFilter)
    const res = await fetch(`/api/quotes?${params}`)
    const data = await res.json()
    setQuotes(data.quotes || [])
    setLoading(false)
  }, [search, statusFilter])

  useEffect(() => {
    fetchQuotes()
  }, [fetchQuotes])

  async function handleDelete(quote: Quote) {
    if (!confirm(`Delete quote ${quote.quote_number}?`)) return
    const res = await fetch(`/api/quotes/${quote.id}`, { method: 'DELETE' })
    if (res.ok) fetchQuotes()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quotes</h1>
          <p className="text-gray-500 mt-0.5 text-sm">{quotes.length} total quotes</p>
        </div>
        <Link href="/quotes/new" className="btn-primary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Quote
        </Link>
      </div>

      {/* Filters */}
      <div className="card mb-4 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search quotes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field flex-1"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field sm:w-40"
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-header">Quote #</th>
                <th className="table-header">Customer</th>
                <th className="table-header">Company</th>
                <th className="table-header">Total</th>
                <th className="table-header">Status</th>
                <th className="table-header">Valid Until</th>
                <th className="table-header">HubSpot</th>
                <th className="table-header">Created</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="table-cell text-center text-gray-400 py-12">Loading...</td></tr>
              ) : quotes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="table-cell text-center py-16">
                    <div className="text-gray-400">
                      <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="font-medium">No quotes yet</p>
                      <Link href="/quotes/new" className="text-blue-600 hover:underline text-sm mt-1 inline-block">
                        Create your first quote
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                quotes.map((quote) => (
                  <tr key={quote.id} className="table-row">
                    <td className="table-cell">
                      <Link href={`/quotes/${quote.id}`} className="font-mono text-sm font-semibold text-blue-600 hover:underline">
                        {quote.quote_number}
                      </Link>
                    </td>
                    <td className="table-cell">{quote.customer_name || '—'}</td>
                    <td className="table-cell text-gray-500">{quote.customer_company || '—'}</td>
                    <td className="table-cell font-semibold">
                      ${quote.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="table-cell">
                      <span className={statusColors[quote.status] || 'badge-gray'}>{quote.status}</span>
                    </td>
                    <td className="table-cell text-gray-500">
                      {quote.valid_until ? new Date(quote.valid_until).toLocaleDateString() : '—'}
                    </td>
                    <td className="table-cell">
                      {quote.hubspot_deal_id
                        ? <span className="badge-green">Synced</span>
                        : <span className="badge-gray">—</span>}
                    </td>
                    <td className="table-cell text-gray-500 text-xs">
                      {new Date(quote.created_at).toLocaleDateString()}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <Link href={`/quotes/${quote.id}`} className="text-gray-600 hover:text-blue-600" title="View/Edit">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Link>
                        <button onClick={() => handleDelete(quote)} className="text-gray-600 hover:text-red-600" title="Delete">
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
    </div>
  )
}
