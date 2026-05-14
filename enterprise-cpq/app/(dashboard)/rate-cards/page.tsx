'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface RateCard {
  id: string
  name: string
  customer: string
  owner: string
  updated_at: string
  created_at: string
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function RateCardsPage() {
  const router = useRouter()
  const [rateCards, setRateCards] = useState<RateCard[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [rcRes, meRes] = await Promise.all([fetch('/api/rate-cards'), fetch('/api/auth/me')])
        const [rcData, meData] = await Promise.all([rcRes.json(), meRes.json()])
        setRateCards(rcData.rateCards || [])
        setIsAdmin(!meData?.role || meData.role === 'admin')
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  async function createRateCard() {
    const res = await fetch('/api/rate-cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Untitled Rate Card' }),
    })
    const data = await res.json()
    if (data.rateCard?.id) router.push(`/rate-cards/${data.rateCard.id}`)
  }

  async function deleteRateCard(id: string) {
    if (!confirm('Delete this rate card?')) return
    setDeleting(id)
    try {
      await fetch(`/api/rate-cards/${id}`, { method: 'DELETE' })
      setRateCards(r => r.filter(x => x.id !== id))
    } finally { setDeleting(null) }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rate Cards</h1>
          <p className="text-gray-500 text-sm mt-1">Manage negotiated pricing for customers</p>
        </div>
        {isAdmin && (
          <button onClick={createRateCard} className="btn-primary" style={{ backgroundColor: '#FF492C' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Rate Card
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-7 h-7 border-2 border-t-transparent rounded-full" style={{ borderColor: '#FF492C', borderTopColor: 'transparent' }} />
        </div>
      ) : rateCards.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
          <p className="text-gray-400 mb-4">No rate cards yet</p>
          {isAdmin && (
            <button onClick={createRateCard} className="btn-primary" style={{ backgroundColor: '#FF492C' }}>
              Create your first rate card
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 font-medium text-gray-500">Name</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Customer</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Owner</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Updated</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rateCards.map(rc => (
                <tr key={rc.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/rate-cards/${rc.id}`)}>
                  <td className="px-5 py-3.5 font-medium text-gray-900">{rc.name || 'Untitled Rate Card'}</td>
                  <td className="px-5 py-3.5 text-gray-500">{rc.customer || '—'}</td>
                  <td className="px-5 py-3.5 text-gray-500">{rc.owner || '—'}</td>
                  <td className="px-5 py-3.5 text-gray-400">{fmt(rc.updated_at || rc.created_at)}</td>
                  <td className="px-5 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                    {isAdmin && (
                      <button
                        onClick={() => deleteRateCard(rc.id)}
                        disabled={deleting === rc.id}
                        className="text-gray-300 hover:text-red-500 p-1 rounded transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
