'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Order } from '@/lib/supabase'

const statusColors: Record<string, string> = {
  pending: 'badge-yellow',
  confirmed: 'badge-blue',
  shipped: 'badge-purple',
  completed: 'badge-green',
  cancelled: 'badge-red',
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    const res = await fetch(`/api/orders?${params}`)
    const data = await res.json()
    setOrders(data.orders || [])
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    fetchOrders()
  }

  async function generateOrderPDF(order: Order) {
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF()

      // Fetch order details
      const res = await fetch(`/api/orders/${order.id}`)
      const { order: fullOrder } = await res.json()

      // Header
      doc.setFillColor(16, 185, 129)
      doc.rect(0, 0, 210, 40, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(22)
      doc.setFont('helvetica', 'bold')
      doc.text('ORDER FORM', 15, 20)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.text(order.order_number, 15, 30)

      doc.setTextColor(0, 0, 0)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('Ship To:', 15, 55)
      doc.setFont('helvetica', 'normal')
      doc.text(order.customer_name || '', 15, 63)
      doc.text(order.customer_company || '', 15, 70)
      doc.text(order.customer_email || '', 15, 77)
      if (order.shipping_address) {
        const lines = doc.splitTextToSize(order.shipping_address, 80)
        doc.text(lines, 15, 84)
      }

      doc.setFont('helvetica', 'bold')
      doc.text('Order Details:', 130, 55)
      doc.setFont('helvetica', 'normal')
      doc.text(`Order: ${order.order_number}`, 130, 63)
      doc.text(`Date: ${new Date(order.created_at).toLocaleDateString()}`, 130, 70)
      doc.text(`Status: ${order.status.toUpperCase()}`, 130, 77)
      if (fullOrder?.quote?.quote_number) {
        doc.text(`Quote: ${fullOrder.quote.quote_number}`, 130, 84)
      }

      const items = fullOrder?.quote?.items || []
      const tableData = items.map((item: { product?: { sku: string; name: string }; quantity: number; unit_price: number; total_price: number }) => [
        item.product?.sku || '',
        item.product?.name || '',
        item.quantity.toString(),
        `$${item.unit_price.toFixed(2)}`,
        `$${item.total_price.toFixed(2)}`,
      ])

      autoTable(doc, {
        startY: 100,
        head: [['SKU', 'Product', 'Qty', 'Unit Price', 'Total']],
        body: tableData,
        headStyles: { fillColor: [16, 185, 129] },
        alternateRowStyles: { fillColor: [240, 253, 250] },
        margin: { left: 15, right: 15 },
      })

      const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.text(`Order Total: $${order.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 130, finalY)

      if (order.notes) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.text('Notes:', 15, finalY + 15)
        doc.setFont('helvetica', 'normal')
        doc.text(doc.splitTextToSize(order.notes, 180), 15, finalY + 23)
      }

      doc.save(`${order.order_number}.pdf`)
    } catch (e) {
      alert('PDF generation failed')
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-500 mt-0.5 text-sm">{orders.length} total orders</p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-field w-auto"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="shipped">Shipped</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-header">Order #</th>
                <th className="table-header">Customer</th>
                <th className="table-header">Company</th>
                <th className="table-header">Quote</th>
                <th className="table-header">Total</th>
                <th className="table-header">Status</th>
                <th className="table-header">HubSpot</th>
                <th className="table-header">Created</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="table-cell text-center py-12 text-gray-400">Loading...</td></tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="table-cell text-center py-16">
                    <div className="text-gray-400">
                      <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                      <p className="font-medium">No orders yet</p>
                      <p className="text-sm mt-1">Convert a quote to create your first order</p>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="table-row">
                    <td className="table-cell font-mono text-sm font-semibold text-green-700">{order.order_number}</td>
                    <td className="table-cell">{order.customer_name || '—'}</td>
                    <td className="table-cell text-gray-500">{order.customer_company || '—'}</td>
                    <td className="table-cell">
                      {order.quote
                        ? <span className="font-mono text-xs text-blue-600">{(order.quote as { quote_number: string }).quote_number}</span>
                        : '—'}
                    </td>
                    <td className="table-cell font-semibold">
                      ${order.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="table-cell">
                      <select
                        value={order.status}
                        onChange={(e) => updateStatus(order.id, e.target.value)}
                        className={`text-xs font-medium rounded-full px-2 py-1 border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          statusColors[order.status]?.replace('badge-', '')
                        }`}
                      >
                        {['pending', 'confirmed', 'shipped', 'completed', 'cancelled'].map(s => (
                          <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                        ))}
                      </select>
                    </td>
                    <td className="table-cell">
                      {order.hubspot_deal_id
                        ? <span className="badge-green">Synced</span>
                        : <span className="badge-gray">—</span>}
                    </td>
                    <td className="table-cell text-gray-500 text-xs">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                    <td className="table-cell">
                      <button
                        onClick={() => generateOrderPDF(order)}
                        className="text-gray-600 hover:text-green-600 transition-colors"
                        title="Download PDF"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </button>
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
