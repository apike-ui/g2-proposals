'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Proposal {
  id: string
  name: string
  customer: string
  rep: string
  grand_total: number
  rate_card_id: string | null
  version_count: number
  updated_at: string
  created_at: string
}

interface RateCard {
  id: string
  name: string
  customer: string
  owner: string
  updated_at: string
}

type FilterTab = 'all' | 'proposals' | 'rate-cards' | 'mine'

export default function ProposalsPage() {
  const router = useRouter()
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [rateCards, setRateCards] = useState<RateCard[]>([])
  const [filter, setFilter] = useState<FilterTab>('all')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [me, setMe] = useState<{ displayName: string; role: string } | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [pRes, rcRes, meRes] = await Promise.all([
          fetch('/api/proposals'),
          fetch('/api/rate-cards'),
          fetch('/api/auth/me'),
        ])
        const [pData, rcData, meData] = await Promise.all([
          pRes.json(),
          rcRes.json(),
          meRes.json(),
        ])
        setProposals(pData.proposals || [])
        setRateCards(rcData.rateCards || [])
        setMe(meData)
      } catch {
        // leave empty
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function createProposal() {
    try {
      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Untitled Proposal' }),
      })
      const data = await res.json()
      if (data.proposal?.id) router.push(`/proposals/${data.proposal.id}`)
    } catch { /* ignore */ }
  }

  async function createRateCard() {
    try {
      const res = await fetch('/api/rate-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Untitled Rate Card' }),
      })
      const data = await res.json()
      if (data.rateCard?.id) router.push(`/rate-cards/${data.rateCard.id}`)
    } catch { /* ignore */ }
  }

  async function deleteProposal(id: string) {
    if (!confirm('Delete this proposal and all its versions?')) return
    setDeleting(id)
    try {
      await fetch(`/api/proposals/${id}`, { method: 'DELETE' })
      setProposals(p => p.filter(x => x.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  async function deleteRateCard(id: string) {
    if (!confirm('Delete this rate card?')) return
    setDeleting(id)
    try {
      await fetch(`/api/rate-cards/${id}`, { method: 'DELETE' })
      setRateCards(r => r.filter(x => x.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  const isAdmin = !me?.role || me.role === 'admin'

  const filteredProposals = filter === 'rate-cards' ? [] : proposals
  const filteredRateCards = filter === 'proposals' || filter === 'mine' ? [] : rateCards
  const showProposals = filter !== 'rate-cards'
  const showRateCards = filter === 'all' || filter === 'rate-cards'

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'proposals', label: 'Proposals' },
    { key: 'rate-cards', label: 'Rate Cards' },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proposals & Rate Cards</h1>
          <p className="text-gray-500 text-sm mt-1">Build G2 proposals and manage customer rate cards</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button onClick={createRateCard} className="btn-secondary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Rate Card
            </button>
          )}
          <button onClick={createProposal} className="btn-primary" style={{ backgroundColor: '#FF492C' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Proposal
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              filter === tab.key
                ? 'border-red-500 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            style={filter === tab.key ? { borderColor: '#FF492C', color: '#FF492C' } : {}}
          >
            {tab.label}
            {tab.key === 'all' && (
              <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                {proposals.length + rateCards.length}
              </span>
            )}
            {tab.key === 'proposals' && (
              <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                {proposals.length}
              </span>
            )}
            {tab.key === 'rate-cards' && (
              <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                {rateCards.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : (
        <div className="space-y-6">
          {/* Proposals Table */}
          {showProposals && (
            <div className="card overflow-hidden">
              {filter === 'all' && (
                <div className="card-header">
                  <h2 className="font-semibold text-gray-900">Proposals</h2>
                  <span className="text-sm text-gray-400">{filteredProposals.length} total</span>
                </div>
              )}
              {filteredProposals.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-gray-400 text-sm mb-3">No proposals yet</p>
                  <button onClick={createProposal} className="btn-primary btn-sm" style={{ backgroundColor: '#FF492C' }}>
                    Create your first proposal
                  </button>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="table-header">Name</th>
                      <th className="table-header">Customer</th>
                      <th className="table-header">Rep</th>
                      <th className="table-header text-right">Grand Total</th>
                      <th className="table-header text-center">Versions</th>
                      <th className="table-header">Updated</th>
                      <th className="table-header" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProposals.map(p => (
                      <tr key={p.id} className="table-row cursor-pointer" onClick={() => router.push(`/proposals/${p.id}`)}>
                        <td className="table-cell">
                          <span className="font-medium text-gray-900">{p.name}</span>
                          {p.rate_card_id && (
                            <span className="ml-2 text-xs badge-purple">Rate Card</span>
                          )}
                        </td>
                        <td className="table-cell text-gray-500">{p.customer || '—'}</td>
                        <td className="table-cell text-gray-500">{p.rep || '—'}</td>
                        <td className="table-cell text-right font-semibold text-gray-900">
                          {p.grand_total > 0 ? `$${p.grand_total.toLocaleString('en-US', { minimumFractionDigits: 0 })}` : '—'}
                        </td>
                        <td className="table-cell text-center">
                          <span className="badge-blue">{p.version_count}</span>
                        </td>
                        <td className="table-cell text-gray-400 text-xs">
                          {new Date(p.updated_at).toLocaleDateString()}
                        </td>
                        <td className="table-cell" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => deleteProposal(p.id)}
                            disabled={deleting === p.id}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Rate Cards Table */}
          {showRateCards && (
            <div className="card overflow-hidden">
              {filter === 'all' && (
                <div className="card-header">
                  <h2 className="font-semibold text-gray-900">Rate Cards</h2>
                  <span className="text-sm text-gray-400">{filteredRateCards.length} total</span>
                </div>
              )}
              {filteredRateCards.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-gray-400 text-sm mb-3">No rate cards yet</p>
                  {isAdmin && (
                    <button onClick={createRateCard} className="btn-secondary btn-sm">
                      Create a rate card
                    </button>
                  )}
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="table-header">Name</th>
                      <th className="table-header">Customer</th>
                      <th className="table-header">Owner</th>
                      <th className="table-header">Updated</th>
                      <th className="table-header" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRateCards.map(rc => (
                      <tr key={rc.id} className="table-row cursor-pointer" onClick={() => router.push(`/rate-cards/${rc.id}`)}>
                        <td className="table-cell font-medium text-gray-900">{rc.name}</td>
                        <td className="table-cell text-gray-500">{rc.customer || '—'}</td>
                        <td className="table-cell text-gray-500">{rc.owner || '—'}</td>
                        <td className="table-cell text-gray-400 text-xs">
                          {new Date(rc.updated_at).toLocaleDateString()}
                        </td>
                        <td className="table-cell" onClick={e => e.stopPropagation()}>
                          {isAdmin && (
                            <button
                              onClick={() => deleteRateCard(rc.id)}
                              disabled={deleting === rc.id}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
