'use client'

import React, { useState, useEffect } from 'react'
import { X, Plus } from 'lucide-react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

type ProductType = 'ONE_TIME' | 'SUBSCRIPTION' | 'PAYMENT_PLAN'
type BillingInterval = 'BI_WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM'
type IntervalUnit = 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS'

interface Coupon {
  id: string
  name: string
  code: string | null
  percentOff: number | null
  amountOff: number | null
  active: boolean
}

interface Product {
  id?: string
  name: string
  description: string | null
  type: ProductType
  price: number
  interval: BillingInterval | null
  intervalCount: number | null
  intervalUnit: IntervalUnit | null
  trialDays: number | null
  planCount: number | null
  planAmount: number | null
  paymentFrequency: BillingInterval | null
  setupFee: number | null
  price6Month: number | null
  price12Month: number | null
  price18Month: number | null
  active: boolean
  coupons?: Coupon[]
}

interface ProductModalProps {
  open: boolean
  onClose: () => void
  product?: Product | null
  onSaved: (product: Product) => void
}

const TYPE_OPTIONS: { key: ProductType; label: string; description: string }[] = [
  { key: 'ONE_TIME', label: 'One-time Payment', description: 'Single charge, immediate access' },
  { key: 'SUBSCRIPTION', label: 'Subscription', description: 'Recurring billing' },
  { key: 'PAYMENT_PLAN', label: 'Payment Plan', description: 'Split total into multiple payments' },
]

const BILLING_PERIODS: { key: BillingInterval; label: string }[] = [
  { key: 'BI_WEEKLY', label: 'Bi-weekly' },
  { key: 'MONTHLY', label: 'Monthly' },
  { key: 'YEARLY', label: 'Yearly' },
  { key: 'CUSTOM', label: 'Custom' },
]

const INTERVAL_UNITS: { key: IntervalUnit; label: string }[] = [
  { key: 'DAYS', label: 'Days' },
  { key: 'WEEKS', label: 'Weeks' },
  { key: 'MONTHS', label: 'Months' },
  { key: 'YEARS', label: 'Years' },
]

const DEFAULT_FORM: Omit<Product, 'id' | 'coupons'> = {
  name: '',
  description: null,
  type: 'ONE_TIME',
  price: 0,
  interval: 'MONTHLY',
  intervalCount: 1,
  intervalUnit: 'MONTHS',
  trialDays: null,
  planCount: null,
  planAmount: null,
  paymentFrequency: 'MONTHLY',
  setupFee: null,
  price6Month: null,
  price12Month: null,
  price18Month: null,
  active: true,
}

const BILLING_PERIOD_LABELS: Record<string, string> = {
  BI_WEEKLY: 'bi-weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  WEEKLY: 'weekly',
  CUSTOM: 'custom',
}

// ─── Billing Period Selector ──────────────────────────────────────────────────

function BillingPeriodSection({
  value,
  intervalCount,
  intervalUnit,
  onChange,
  onIntervalCountChange,
  onIntervalUnitChange,
}: {
  value: BillingInterval
  intervalCount: number | null
  intervalUnit: IntervalUnit | null
  onChange: (v: BillingInterval) => void
  onIntervalCountChange: (v: number | null) => void
  onIntervalUnitChange: (v: IntervalUnit) => void
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Billing Period</label>
        <div className="grid grid-cols-4 gap-2">
          {BILLING_PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => onChange(p.key)}
              className={cn(
                'rounded-lg border py-2 text-sm font-medium transition-all',
                value === p.key
                  ? 'border-[#0D1B2A] bg-[#0D1B2A] text-white'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom interval fields */}
      {value === 'CUSTOM' && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Custom Interval</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 shrink-0">Every</span>
            <input
              type="number"
              min="1"
              value={intervalCount ?? 1}
              onChange={(e) => onIntervalCountChange(parseInt(e.target.value) || 1)}
              className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#0D1B2A]/20"
            />
            <select
              value={intervalUnit ?? 'MONTHS'}
              onChange={(e) => onIntervalUnitChange(e.target.value as IntervalUnit)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1B2A]/20"
            >
              {INTERVAL_UNITS.map((u) => (
                <option key={u.key} value={u.key}>{u.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function ProductModal({ open, onClose, product, onSaved }: ProductModalProps) {
  const [form, setForm] = useState(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [couponCode, setCouponCode] = useState('')
  const [addingCoupon, setAddingCoupon] = useState(false)
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      if (product) {
        setForm({
          name: product.name,
          description: product.description,
          type: product.type,
          price: product.price,
          interval: product.interval ?? 'MONTHLY',
          intervalCount: product.intervalCount ?? 1,
          intervalUnit: product.intervalUnit as IntervalUnit ?? 'MONTHS',
          trialDays: product.trialDays,
          planCount: product.planCount,
          planAmount: product.planAmount,
          paymentFrequency: product.paymentFrequency ?? 'MONTHLY',
          setupFee: product.setupFee,
          price6Month: product.price6Month ?? null,
          price12Month: product.price12Month ?? null,
          price18Month: product.price18Month ?? null,
          active: product.active,
        })
        setCoupons(product.coupons ?? [])
      } else {
        setForm(DEFAULT_FORM)
        setCoupons([])
      }
      setError('')
      setCouponCode('')
    }
  }, [open, product])

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    try {
      const url = product?.id ? `/api/products/${product.id}` : '/api/products'
      const method = product?.id ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error(await res.text())
      const saved = await res.json()
      onSaved(saved)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleAddCoupon = async () => {
    if (!couponCode.trim() || !product?.id) return
    setAddingCoupon(true)
    try {
      const res = await fetch(`/api/products/${product.id}/coupons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode }),
      })
      if (!res.ok) throw new Error('Coupon not found in Stripe')
      const coupon = await res.json()
      setCoupons((c) => [...c, coupon])
      setCouponCode('')
    } catch {
      setError('Could not add coupon — check the Stripe coupon code')
    } finally {
      setAddingCoupon(false)
    }
  }

  if (typeof window === 'undefined') return null

  const perPayment =
    form.type === 'PAYMENT_PLAN' && form.planAmount && form.planCount
      ? form.planAmount / form.planCount
      : null

  const billingLabel = (() => {
    const freq = form.type === 'SUBSCRIPTION' ? form.interval : form.paymentFrequency
    if (freq === 'CUSTOM' && form.intervalCount && form.intervalUnit) {
      return `every ${form.intervalCount} ${form.intervalUnit.toLowerCase()}`
    }
    return BILLING_PERIOD_LABELS[freq ?? 'MONTHLY'] ?? freq?.toLowerCase() ?? ''
  })()

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-12 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/30"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl mb-12"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">
                {product?.id ? 'Edit Product' : 'New Product'}
              </h2>
              <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="e.g. Monthly Coaching Package"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1B2A]/20 focus:border-[#0D1B2A]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description ?? ''}
                  onChange={(e) => set('description', e.target.value || null)}
                  rows={2}
                  placeholder="Optional — shown on payment page"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1B2A]/20 focus:border-[#0D1B2A] resize-none"
                />
              </div>

              {/* Product Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Product Type</label>
                <div className="grid grid-cols-3 gap-3">
                  {TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => set('type', opt.key)}
                      className={cn(
                        'text-left border rounded-xl p-3 transition-all',
                        form.type === opt.key
                          ? 'border-[#0D1B2A] bg-[#0D1B2A]/5 ring-1 ring-[#0D1B2A]'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <p className="text-sm font-semibold text-gray-900">{opt.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── ONE-TIME ── */}
              {form.type === 'ONE_TIME' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
                  <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#0D1B2A]/20">
                    <span className="px-3 py-2 text-sm text-gray-400 bg-gray-50 border-r border-gray-200">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.price || ''}
                      onChange={(e) => set('price', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="flex-1 px-3 py-2 text-sm focus:outline-none"
                    />
                    <span className="px-3 py-2 text-sm text-gray-400 bg-gray-50 border-l border-gray-200">USD</span>
                  </div>
                </div>
              )}

              {/* ── SUBSCRIPTION ── */}
              {form.type === 'SUBSCRIPTION' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
                      <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#0D1B2A]/20">
                        <span className="px-3 py-2 text-sm text-gray-400 bg-gray-50 border-r border-gray-200">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.price || ''}
                          onChange={(e) => set('price', parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="flex-1 px-3 py-2 text-sm focus:outline-none"
                        />
                        <span className="px-3 py-2 text-sm text-gray-400 bg-gray-50 border-l border-gray-200">USD</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Trial Period (days)</label>
                      <input
                        type="number"
                        min="0"
                        value={form.trialDays ?? ''}
                        onChange={(e) => set('trialDays', e.target.value ? parseInt(e.target.value) : null)}
                        placeholder="No trial"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1B2A]/20"
                      />
                    </div>
                  </div>

                  <BillingPeriodSection
                    value={form.interval ?? 'MONTHLY'}
                    intervalCount={form.intervalCount}
                    intervalUnit={form.intervalUnit as IntervalUnit}
                    onChange={(v) => set('interval', v)}
                    onIntervalCountChange={(v) => set('intervalCount', v)}
                    onIntervalUnitChange={(v) => set('intervalUnit', v)}
                  />

                  {/* Setup Fee */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Setup Fee <span className="text-gray-400 font-normal">(optional one-time charge)</span>
                    </label>
                    <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#0D1B2A]/20">
                      <span className="px-3 py-2 text-sm text-gray-400 bg-gray-50 border-r border-gray-200">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.setupFee ?? ''}
                        onChange={(e) => set('setupFee', e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="0.00"
                        className="flex-1 px-3 py-2 text-sm focus:outline-none"
                      />
                      <span className="px-3 py-2 text-sm text-gray-400 bg-gray-50 border-l border-gray-200">USD</span>
                    </div>
                    {form.setupFee ? (
                      <p className="text-xs text-gray-400 mt-1">
                        Charged once at signup, then ${form.price.toFixed(2)} {billingLabel}
                      </p>
                    ) : null}
                  </div>

                  {/* Retainer Duration Pricing */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Retainer Duration Pricing <span className="text-gray-400 font-normal">(optional — overrides base price per duration)</span>
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {([
                        { label: '6 months', field: 'price6Month' as const },
                        { label: '12 months', field: 'price12Month' as const },
                        { label: '18 months', field: 'price18Month' as const },
                      ]).map(({ label, field }) => (
                        <div key={field}>
                          <p className="text-xs text-gray-500 mb-1">{label}</p>
                          <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#0D1B2A]/20">
                            <span className="px-2 py-2 text-xs text-gray-400 bg-gray-50 border-r border-gray-200">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={form[field] ?? ''}
                              onChange={(e) => set(field, e.target.value ? parseFloat(e.target.value) : null)}
                              placeholder="—"
                              className="flex-1 px-2 py-2 text-sm focus:outline-none min-w-0"
                            />
                          </div>
                          {form[field] && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              ${(form[field]! * (field === 'price6Month' ? 6 : field === 'price12Month' ? 12 : 18)).toLocaleString()} total
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ── PAYMENT PLAN ── */}
              {form.type === 'PAYMENT_PLAN' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount ($)</label>
                      <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#0D1B2A]/20">
                        <span className="px-3 py-2 text-sm text-gray-400 bg-gray-50 border-r border-gray-200">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.planAmount ?? ''}
                          onChange={(e) => set('planAmount', parseFloat(e.target.value) || null)}
                          placeholder="0.00"
                          className="flex-1 px-3 py-2 text-sm focus:outline-none"
                        />
                        <span className="px-3 py-2 text-sm text-gray-400 bg-gray-50 border-l border-gray-200">USD</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Number of Payments</label>
                      <input
                        type="number"
                        min="1"
                        value={form.planCount ?? ''}
                        onChange={(e) => set('planCount', parseInt(e.target.value) || null)}
                        placeholder="e.g. 3"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1B2A]/20"
                      />
                    </div>
                  </div>

                  <BillingPeriodSection
                    value={form.paymentFrequency ?? 'MONTHLY'}
                    intervalCount={form.intervalCount}
                    intervalUnit={form.intervalUnit as IntervalUnit}
                    onChange={(v) => set('paymentFrequency', v)}
                    onIntervalCountChange={(v) => set('intervalCount', v)}
                    onIntervalUnitChange={(v) => set('intervalUnit', v)}
                  />

                  {perPayment !== null && (
                    <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                      <span className="font-semibold text-gray-700">{form.planCount} {billingLabel} payments</span>
                      {' '}of{' '}
                      <span className="font-semibold text-gray-700">${perPayment.toFixed(2)}</span>
                      {' '}= ${form.planAmount?.toFixed(2)} total
                    </p>
                  )}

                  {/* Setup Fee */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Setup Fee <span className="text-gray-400 font-normal">(optional one-time charge)</span>
                    </label>
                    <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#0D1B2A]/20">
                      <span className="px-3 py-2 text-sm text-gray-400 bg-gray-50 border-r border-gray-200">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.setupFee ?? ''}
                        onChange={(e) => set('setupFee', e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="0.00"
                        className="flex-1 px-3 py-2 text-sm focus:outline-none"
                      />
                      <span className="px-3 py-2 text-sm text-gray-400 bg-gray-50 border-l border-gray-200">USD</span>
                    </div>
                    {form.setupFee ? (
                      <p className="text-xs text-gray-400 mt-1">
                        ${form.setupFee.toFixed(2)} due at signup, then {form.planCount} {billingLabel} payments of ${perPayment?.toFixed(2)}
                      </p>
                    ) : null}
                  </div>
                </>
              )}

              {/* Active toggle */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.active}
                  onClick={() => set('active', !form.active)}
                  className={cn(
                    'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                    form.active ? 'bg-[#0D1B2A]' : 'bg-gray-200'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
                      form.active ? 'translate-x-4' : 'translate-x-1'
                    )}
                  />
                </button>
                <span className="text-sm text-gray-700">Active (visible on payment page)</span>
              </div>

              {/* Coupons — only for existing products */}
              {product?.id && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Discount Codes</label>
                  {coupons.length > 0 && (
                    <div className="space-y-1 mb-3">
                      {coupons.map((c) => (
                        <div key={c.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                          <div>
                            <span className="text-sm font-medium text-gray-800">{c.name}</span>
                            {c.code && <span className="ml-2 text-xs text-gray-500 font-mono">{c.code}</span>}
                            <span className="ml-2 text-xs text-green-600">
                              {c.percentOff ? `${c.percentOff}% off` : c.amountOff ? `$${c.amountOff} off` : ''}
                            </span>
                          </div>
                          <span className={cn('text-xs rounded-full px-2 py-0.5', c.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500')}>
                            {c.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      placeholder="Stripe coupon code"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1B2A]/20"
                    />
                    <button
                      type="button"
                      onClick={handleAddCoupon}
                      disabled={addingCoupon || !couponCode.trim()}
                      className="flex items-center gap-1.5 bg-[#0D1B2A] text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-[#1B263B] disabled:opacity-40"
                    >
                      <Plus size={14} />
                      {addingCoupon ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-[#0D1B2A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B263B] disabled:opacity-40"
              >
                {saving ? 'Saving...' : product?.id ? 'Save Changes' : 'Create Product'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
