'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Link2, ExternalLink, ToggleLeft, ToggleRight, Copy, Check } from 'lucide-react'
import { format, differenceInMonths } from 'date-fns'
import { PageHeader } from '@/components/ui/page-header'
import { ActionMenu } from '@/components/ui/action-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ProductModal } from '@/components/products/product-modal'
import { OrderSlideOver } from '@/components/products/order-slide-over'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductType = 'ONE_TIME' | 'SUBSCRIPTION' | 'PAYMENT_PLAN'
type ProductInterval = 'BI_WEEKLY' | 'MONTHLY' | 'ANNUAL' | 'YEARLY' | 'CUSTOM' | string
type PaymentFrequency = 'BI_WEEKLY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM'

interface Product {
  id: string
  name: string
  description: string | null
  type: ProductType
  price: number
  interval: ProductInterval | null
  intervalCount: number | null
  intervalUnit: string | null
  trialDays: number | null
  planCount: number | null
  planAmount: number | null
  paymentFrequency: PaymentFrequency | null
  active: boolean
  archivedAt: string | null
  createdAt: string
  coupons: { id: string; name: string; code: string | null; percentOff: number | null; amountOff: number | null; active: boolean }[]
}

interface Order {
  id: string
  amount: number
  currency: string
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'
  createdAt: string
  contact: { id: string; firstName: string; lastName: string }
  company: { id: string; name: string } | null
  product: { id: string; name: string; type: string }
  invoices: { id: string; number: string; status: string; sentAt: string | null }[]
}

interface Subscription {
  id: string
  status: 'ACTIVE' | 'CANCELLED' | 'PAST_DUE'
  createdAt: string
  nextBillingDate: string | null
  stripeSubId: string | null
  monthsActive: number
  contact: { id: string; firstName: string; lastName: string }
  company: { id: string; name: string } | null
  product: { id: string; name: string; type: string; interval: string | null; price: number }
}

interface Invoice {
  id: string
  number: string
  amount: number
  currency: string
  status: 'DRAFT' | 'SENT' | 'PAID'
  sentAt: string | null
  createdAt: string
  contact: { id: string; firstName: string; lastName: string }
  order: { product: { id: string; name: string } }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<ProductType, string> = {
  ONE_TIME: 'One-time',
  SUBSCRIPTION: 'Subscription',
  PAYMENT_PLAN: 'Payment Plan',
}

const TYPE_COLORS: Record<ProductType, string> = {
  ONE_TIME: 'bg-blue-50 text-blue-700 border-blue-200',
  SUBSCRIPTION: 'bg-purple-50 text-purple-700 border-purple-200',
  PAYMENT_PLAN: 'bg-amber-50 text-amber-700 border-amber-200',
}

const STATUS_COLORS = {
  PAID: 'bg-green-50 text-green-700',
  PENDING: 'bg-yellow-50 text-yellow-700',
  FAILED: 'bg-red-50 text-red-700',
  REFUNDED: 'bg-gray-100 text-gray-500',
  ACTIVE: 'bg-green-50 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
  PAST_DUE: 'bg-red-50 text-red-600',
  DRAFT: 'bg-gray-100 text-gray-500',
  SENT: 'bg-blue-50 text-blue-700',
}

function formatPrice(amount: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount)
}

function productPriceLabel(p: Product): string {
  if (p.type === 'ONE_TIME') return formatPrice(p.price)
  if (p.type === 'SUBSCRIPTION') {
    const interval = p.interval === 'ANNUAL' ? '/yr' : '/mo'
    return `${formatPrice(p.price)}${interval}`
  }
  if (p.type === 'PAYMENT_PLAN' && p.planAmount && p.planCount) {
    const each = p.planAmount / p.planCount
    return `${p.planCount}× ${formatPrice(each)}`
  }
  return formatPrice(p.price)
}

// ─── CopyLinkButton ───────────────────────────────────────────────────────────

function CopyLinkButton({ productId }: { productId: string }) {
  const [copied, setCopied] = useState(false)
  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/pay/${productId}`

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      title="Copy payment link"
      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
    >
      {copied ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
    </button>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = ['Products', 'Orders', 'Subscriptions', 'Invoices']

export default function ProductsPage() {
  const [tab, setTab] = useState('Products')
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [confirmCancelSub, setConfirmCancelSub] = useState<string | null>(null)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/products')
    const data = await res.json()
    setProducts(data.products ?? [])
    setLoading(false)
  }, [])

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/orders')
    const data = await res.json()
    setOrders(data.orders ?? [])
    setLoading(false)
  }, [])

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/subscriptions')
    const data = await res.json()
    setSubscriptions(data.subscriptions ?? [])
    setLoading(false)
  }, [])

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/invoices')
    const data = await res.json()
    setInvoices(data.invoices ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (tab === 'Products') fetchProducts()
    else if (tab === 'Orders') fetchOrders()
    else if (tab === 'Subscriptions') fetchSubscriptions()
    else if (tab === 'Invoices') fetchInvoices()
  }, [tab, fetchProducts, fetchOrders, fetchSubscriptions, fetchInvoices])

  const handleToggleActive = async (product: Product) => {
    await fetch(`/api/products/${product.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !product.active }),
    })
    fetchProducts()
  }

  const handleArchive = async (id: string) => {
    await fetch(`/api/products/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archive: true }),
    })
    fetchProducts()
  }

  const handleDuplicate = async (product: Product) => {
    await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${product.name} (Copy)`,
        description: product.description,
        type: product.type,
        price: product.price,
        interval: product.interval,
        trialDays: product.trialDays,
        planCount: product.planCount,
        planAmount: product.planAmount,
        paymentFrequency: product.paymentFrequency,
        active: false,
      }),
    })
    fetchProducts()
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/products/${id}`, { method: 'DELETE' })
    setConfirmDelete(null)
    fetchProducts()
  }

  const handleCancelSub = async (id: string) => {
    await fetch(`/api/subscriptions/${id}/cancel`, { method: 'PATCH' })
    setConfirmCancelSub(null)
    fetchSubscriptions()
  }

  const handleSendInvoice = async (invoiceId: string) => {
    await fetch(`/api/invoices/${invoiceId}/send`, { method: 'POST' })
    fetchInvoices()
  }

  return (
    <>
      <PageHeader
        title="Products"
        actions={
          tab === 'Products' ? (
            <button
              onClick={() => { setEditingProduct(null); setShowModal(true) }}
              className="flex items-center gap-1.5 bg-[#0D1B2A] text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-[#1B263B] transition-colors"
            >
              <Plus size={15} />
              New Product
            </button>
          ) : undefined
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
              tab === t
                ? 'bg-[#0D1B2A] text-white'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Products Tab ── */}
      {tab === 'Products' && (
        <>
          {loading ? (
            <LoadingSkeleton variant="table" rows={6} />
          ) : products.length === 0 ? (
            <EmptyState
              title="No products yet"
              description="Create your first product to start accepting payments."
              action={
                <button
                  onClick={() => { setEditingProduct(null); setShowModal(true) }}
                  className="flex items-center gap-1.5 bg-[#0D1B2A] text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-[#1B263B]"
                >
                  <Plus size={15} />
                  New Product
                </button>
              }
            />
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Header row */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{product.name}</p>
                      {product.description && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">{product.description}</p>
                      )}
                    </div>
                    <ActionMenu
                      items={[
                        { label: 'Edit', onClick: () => { setEditingProduct(product); setShowModal(true) } },
                        { label: 'Duplicate', onClick: () => handleDuplicate(product) },
                        { label: 'Archive', onClick: () => handleArchive(product.id), separator: true },
                        { label: 'Delete', onClick: () => setConfirmDelete(product.id), danger: true },
                      ]}
                    />
                  </div>

                  {/* Type badge */}
                  <span
                    className={cn(
                      'inline-block rounded-full border px-2 py-0.5 text-xs font-semibold mb-3',
                      TYPE_COLORS[product.type]
                    )}
                  >
                    {TYPE_LABELS[product.type]}
                  </span>

                  {/* Price */}
                  <p className="text-xl font-bold text-gray-900 mb-4">{productPriceLabel(product)}</p>

                  {/* Footer row */}
                  <div className="flex items-center justify-between">
                    {/* Active toggle */}
                    <button
                      onClick={() => handleToggleActive(product)}
                      className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      {product.active ? (
                        <ToggleRight size={18} className="text-green-500" />
                      ) : (
                        <ToggleLeft size={18} className="text-gray-400" />
                      )}
                      {product.active ? 'Active' : 'Inactive'}
                    </button>

                    {/* Icons */}
                    <div className="flex items-center gap-1">
                      <a
                        href={`/pay/${product.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="View payment page"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        <ExternalLink size={15} />
                      </a>
                      <CopyLinkButton productId={product.id} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Orders Tab ── */}
      {tab === 'Orders' && (
        <>
          {loading ? (
            <LoadingSkeleton variant="table" rows={6} />
          ) : orders.length === 0 ? (
            <EmptyState title="No orders yet" description="Orders appear when payments are made." />
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">Contact</th>
                    <th className="px-4 py-3 text-left">Company</th>
                    <th className="px-4 py-3 text-left">Product</th>
                    <th className="px-4 py-3 text-left">Amount</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrderId(order.id)}
                      className="border-b border-gray-50 hover:bg-gray-50/60 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {order.contact.firstName} {order.contact.lastName}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{order.company?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-700">{order.product.name}</td>
                      <td className="px-4 py-3 font-medium">{formatPrice(order.amount, order.currency)}</td>
                      <td className="px-4 py-3">
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', STATUS_COLORS[order.status])}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{format(new Date(order.createdAt), 'MMM d, yyyy')}</td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {order.invoices.length > 0 ? (
                          <span className="text-xs text-gray-400">{order.invoices[0].number}</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Subscriptions Tab ── */}
      {tab === 'Subscriptions' && (
        <>
          {loading ? (
            <LoadingSkeleton variant="table" rows={6} />
          ) : subscriptions.length === 0 ? (
            <EmptyState title="No subscriptions" description="Subscriptions appear when customers subscribe to a recurring product." />
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">Contact</th>
                    <th className="px-4 py-3 text-left">Company</th>
                    <th className="px-4 py-3 text-left">Product</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Start Date</th>
                    <th className="px-4 py-3 text-left">Next Billing</th>
                    <th className="px-4 py-3 text-left">Months Active</th>
                    <th className="px-4 py-3 text-left">Stripe ID</th>
                    <th className="px-4 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((sub) => {
                    const months = differenceInMonths(new Date(), new Date(sub.createdAt))
                    return (
                      <tr key={sub.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {sub.contact.firstName} {sub.contact.lastName}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{sub.company?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{sub.product.name}</td>
                        <td className="px-4 py-3">
                          <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', STATUS_COLORS[sub.status])}>
                            {sub.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{format(new Date(sub.createdAt), 'MMM d, yyyy')}</td>
                        <td className="px-4 py-3 text-gray-500">
                          {sub.nextBillingDate ? format(new Date(sub.nextBillingDate), 'MMM d, yyyy') : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{months} months</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono text-gray-400 truncate max-w-[120px] block">
                            {sub.stripeSubId ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <ActionMenu
                            items={[
                              {
                                label: 'Cancel Subscription',
                                onClick: () => setConfirmCancelSub(sub.id),
                                danger: true,
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Invoices Tab ── */}
      {tab === 'Invoices' && (
        <>
          {loading ? (
            <LoadingSkeleton variant="table" rows={6} />
          ) : invoices.length === 0 ? (
            <EmptyState title="No invoices" description="Invoices are generated automatically after payment." />
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">Invoice #</th>
                    <th className="px-4 py-3 text-left">Contact</th>
                    <th className="px-4 py-3 text-left">Product</th>
                    <th className="px-4 py-3 text-left">Amount</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Sent</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                      <td className="px-4 py-3 font-mono text-sm font-medium text-gray-800">{inv.number}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {inv.contact.firstName} {inv.contact.lastName}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{inv.order.product.name}</td>
                      <td className="px-4 py-3 font-medium">{formatPrice(inv.amount, inv.currency)}</td>
                      <td className="px-4 py-3">
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', STATUS_COLORS[inv.status])}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {inv.sentAt ? format(new Date(inv.sentAt), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleSendInvoice(inv.id)}
                          className="text-xs font-medium text-[#0D1B2A] hover:underline"
                        >
                          {inv.status === 'DRAFT' ? 'Send' : 'Resend'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <ProductModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditingProduct(null) }}
        product={editingProduct as any}
        onSaved={() => fetchProducts()}
      />

      <OrderSlideOver
        orderId={selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Product"
        description="This will permanently delete the product. Orders and subscriptions will remain."
        confirmLabel="Delete"
        onConfirm={() => handleDelete(confirmDelete!)}
        onClose={() => setConfirmDelete(null)}
        destructive
      />

      <ConfirmDialog
        open={!!confirmCancelSub}
        title="Cancel Subscription"
        description="This will cancel the subscription immediately in Stripe. This cannot be undone."
        confirmLabel="Cancel Subscription"
        onConfirm={() => handleCancelSub(confirmCancelSub!)}
        onClose={() => setConfirmCancelSub(null)}
        destructive
      />
    </>
  )
}
