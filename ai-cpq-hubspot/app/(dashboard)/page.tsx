'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Stats {
  totalProducts: number
  totalQuotes: number
  totalOrders: number
  totalRevenue: number
  recentQuotes: Array<{
    id: string
    quote_number: string
    customer_name: string | null
    customer_company: string | null
    total_amount: number
    status: string
    created_at: string
  }>
}

const statusColors: Record<string, string> = {
  draft: 'badge-gray',
  sent: 'badge-blue',
  accepted: 'badge-green',
  rejected: 'badge-red',
  expired: 'badge-yellow',
  pending: 'badge-yellow',
  confirmed: 'badge-blue',
  completed: 'badge-green',
  cancelled: 'badge-red',
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalProducts: 0,
    totalQuotes: 0,
    totalOrders: 0,
    totalRevenue: 0,
    recentQuotes: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const [productsRes, quotesRes, ordersRes] = await Promise.all([
          fetch('/api/products'),
          fetch('/api/quotes'),
          fetch('/api/orders'),
        ])

        const [productsData, quotesData, ordersData] = await Promise.all([
          productsRes.json(),
          quotesRes.json(),
          ordersRes.json(),
        ])

        const quotes = quotesData.quotes || []
        const orders = ordersData.orders || []
        const revenue = orders
          .filter((o: { status: string }) => o.status === 'completed')
          .reduce((sum: number, o: { total_amount: number }) => sum + (o.total_amount || 0), 0)

        setStats({
          totalProducts: (productsData.products || []).length,
          totalQuotes: quotes.length,
          totalOrders: orders.length,
          totalRevenue: revenue,
          recentQuotes: quotes.slice(0, 5),
        })
      } catch (err) {
        console.error('Failed to load stats', err)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  const statCards = [
    {
      label: 'Total Products',
      value: stats.totalProducts,
      icon: '📦',
      href: '/products',
      color: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Active Quotes',
      value: stats.totalQuotes,
      icon: '📄',
      href: '/quotes',
      color: 'bg-purple-50 text-purple-700',
    },
    {
      label: 'Orders',
      value: stats.totalOrders,
      icon: '🛒',
      href: '/orders',
      color: 'bg-green-50 text-green-700',
    },
    {
      label: 'Revenue (Completed)',
      value: `$${stats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      icon: '💰',
      href: '/orders',
      color: 'bg-amber-50 text-amber-700',
    },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of your CPQ pipeline</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <Link key={card.label} href={card.href} className="card p-5 hover:shadow-md transition-shadow group">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className={`text-2xl font-bold mt-1 ${loading ? 'animate-pulse bg-gray-200 rounded h-8 w-24' : ''}`}>
                  {loading ? '' : card.value}
                </p>
              </div>
              <span className={`text-2xl p-2 rounded-xl ${card.color}`}>{card.icon}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
          <div className="space-y-2">
            <Link href="/quotes/new" className="btn-primary w-full justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create New Quote
            </Link>
            <Link href="/upload" className="btn-secondary w-full justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Import SKUs from Excel
            </Link>
            <Link href="/hubspot" className="btn-secondary w-full justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Sync with HubSpot
            </Link>
          </div>
        </div>

        {/* Recent Quotes */}
        <div className="card lg:col-span-2">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900">Recent Quotes</h3>
            <Link href="/quotes" className="text-sm text-blue-600 hover:text-blue-800">View all</Link>
          </div>
          <div className="divide-y divide-gray-100">
            {loading ? (
              <div className="p-6 text-center text-gray-400">Loading...</div>
            ) : stats.recentQuotes.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-gray-400 text-sm">No quotes yet.</p>
                <Link href="/quotes/new" className="btn-primary btn-sm mt-3 inline-flex">Create your first quote</Link>
              </div>
            ) : (
              stats.recentQuotes.map((q) => (
                <Link key={q.id} href={`/quotes/${q.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{q.quote_number}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {q.customer_name || 'No customer'} {q.customer_company ? `· ${q.customer_company}` : ''}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-gray-900">
                      ${q.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                    <span className={statusColors[q.status] || 'badge-gray'}>{q.status}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* AI CPQ Banner */}
      <div className="card p-6 bg-gradient-to-r from-blue-600 to-indigo-600 border-0">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="text-white">
            <h3 className="font-bold text-lg">AI-Powered Quote Generation</h3>
            <p className="text-blue-100 text-sm mt-1">
              Describe customer requirements and let AI suggest the right products automatically.
            </p>
          </div>
          <Link href="/quotes/new" className="bg-white text-blue-600 hover:bg-blue-50 font-medium px-5 py-2 rounded-lg text-sm transition-colors flex-shrink-0">
            Try AI Quoting →
          </Link>
        </div>
      </div>
    </div>
  )
}
