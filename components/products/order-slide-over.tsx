'use client'

import React, { useState, useEffect } from 'react'
import { X, FileText, Send, ExternalLink } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface Order {
  id: string
  amount: number
  currency: string
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'
  createdAt: string
  stripeSessionId: string | null
  contact: {
    id: string
    firstName: string
    lastName: string
    email: string | null
    phone: string | null
  }
  company: { id: string; name: string } | null
  product: { id: string; name: string; type: string }
  invoices: {
    id: string
    number: string
    status: string
    sentAt: string | null
  }[]
}

const STATUS_STYLES = {
  PAID: 'bg-green-50 text-green-700',
  PENDING: 'bg-yellow-50 text-yellow-700',
  FAILED: 'bg-red-50 text-red-700',
  REFUNDED: 'bg-gray-100 text-gray-600',
}

export function OrderSlideOver({
  orderId,
  onClose,
}: {
  orderId: string | null
  onClose: () => void
}) {
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(false)
  const [generatingInvoice, setGeneratingInvoice] = useState(false)
  const [sendingInvoice, setSendingInvoice] = useState(false)

  useEffect(() => {
    if (!orderId) { setOrder(null); return }
    setLoading(true)
    fetch(`/api/orders/${orderId}`)
      .then((r) => r.json())
      .then((data) => setOrder(data))
      .finally(() => setLoading(false))
  }, [orderId])

  const handleGenerateInvoice = async () => {
    if (!order) return
    setGeneratingInvoice(true)
    try {
      const res = await fetch('/api/invoices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      })
      const inv = await res.json()
      setOrder((o) => o ? { ...o, invoices: [...o.invoices, inv] } : o)
    } finally {
      setGeneratingInvoice(false)
    }
  }

  const handleSendInvoice = async (invoiceId: string) => {
    setSendingInvoice(true)
    try {
      await fetch(`/api/invoices/${invoiceId}/send`, { method: 'POST' })
      setOrder((o) =>
        o ? {
          ...o,
          invoices: o.invoices.map((i) =>
            i.id === invoiceId ? { ...i, status: 'SENT', sentAt: new Date().toISOString() } : i
          ),
        } : o
      )
    } finally {
      setSendingInvoice(false)
    }
  }

  const formatCurrency = (amount: number, currency = 'usd') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(amount)

  return (
    <AnimatePresence>
      {orderId && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-[480px] bg-white shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 shrink-0">
              <h2 className="text-base font-semibold text-gray-900">Order Detail</h2>
              <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loading && (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              )}

              {!loading && order && (
                <>
                  {/* Status + amount */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(order.amount, order.currency)}
                      </p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {format(new Date(order.createdAt), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                    <span className={cn('rounded-full px-3 py-1 text-sm font-semibold', STATUS_STYLES[order.status])}>
                      {order.status}
                    </span>
                  </div>

                  {/* Contact */}
                  <div className="bg-gray-50 rounded-xl p-4 space-y-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Contact</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {order.contact.firstName} {order.contact.lastName}
                    </p>
                    {order.contact.email && <p className="text-sm text-gray-500">{order.contact.email}</p>}
                    {order.contact.phone && <p className="text-sm text-gray-500">{order.contact.phone}</p>}
                    {order.company && <p className="text-sm text-gray-500">{order.company.name}</p>}
                  </div>

                  {/* Product */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Product</p>
                    <p className="text-sm font-semibold text-gray-800">{order.product.name}</p>
                    <p className="text-xs text-gray-500">{order.product.type.replace('_', ' ')}</p>
                  </div>

                  {/* Stripe */}
                  {order.stripeSessionId && (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Stripe</p>
                      <p className="text-xs font-mono text-gray-600 truncate">{order.stripeSessionId}</p>
                    </div>
                  )}

                  {/* Invoices */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-gray-700">Invoices</p>
                      {order.invoices.length === 0 && (
                        <button
                          onClick={handleGenerateInvoice}
                          disabled={generatingInvoice}
                          className="flex items-center gap-1.5 text-xs font-medium text-[#0D1B2A] hover:underline disabled:opacity-40"
                        >
                          <FileText size={13} />
                          {generatingInvoice ? 'Generating...' : 'Generate Invoice'}
                        </button>
                      )}
                    </div>

                    {order.invoices.length === 0 ? (
                      <p className="text-sm text-gray-400">No invoices yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {order.invoices.map((inv) => (
                          <div
                            key={inv.id}
                            className="flex items-center justify-between border border-gray-200 rounded-xl px-3 py-2.5"
                          >
                            <div>
                              <p className="text-sm font-medium text-gray-800">{inv.number}</p>
                              <p className="text-xs text-gray-500">
                                {inv.sentAt
                                  ? `Sent ${format(new Date(inv.sentAt), 'MMM d')}`
                                  : inv.status}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  'text-xs rounded-full px-2 py-0.5',
                                  inv.status === 'SENT' || inv.status === 'PAID'
                                    ? 'bg-green-50 text-green-700'
                                    : 'bg-gray-100 text-gray-500'
                                )}
                              >
                                {inv.status}
                              </span>
                              <button
                                onClick={() => handleSendInvoice(inv.id)}
                                disabled={sendingInvoice}
                                title="Send invoice"
                                className="text-gray-400 hover:text-[#0D1B2A] transition-colors disabled:opacity-40"
                              >
                                <Send size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
