'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

interface Product {
  id: string
  name: string
  description: string | null
  type: 'ONE_TIME' | 'SUBSCRIPTION' | 'PAYMENT_PLAN'
  price: number
  interval: 'MONTHLY' | 'ANNUAL' | null
  trialDays: number | null
  planCount: number | null
  planAmount: number | null
  paymentFrequency: 'WEEKLY' | 'MONTHLY' | null
  stripePriceId: string | null
}

function formatPrice(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export default function PayPage() {
  const params = useParams<{ productId: string }>()
  const searchParams = useSearchParams()

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [contact, setContact] = useState({ firstName: '', lastName: '', email: '', phone: '' })
  const [couponCode, setCouponCode] = useState('')
  const [couponId, setCouponId] = useState<string | null>(null)
  const [couponDiscount, setCouponDiscount] = useState('')
  const [checkingCoupon, setCheckingCoupon] = useState(false)
  const [couponError, setCouponError] = useState('')

  const [step, setStep] = useState<'info' | 'review'>('info')
  const [redirecting, setRedirecting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/products/${params.productId}/public`)
      .then((r) => { if (!r.ok) { setNotFound(true); return null } return r.json() })
      .then((data) => { if (data) setProduct(data); setLoading(false) })
  }, [params.productId])

  useEffect(() => {
    const contactId = searchParams.get('contactId')
    if (!contactId) return
    fetch(`/api/contacts/${contactId}`)
      .then((r) => r.json())
      .then((c) => setContact({
        firstName: c.firstName ?? '',
        lastName: c.lastName ?? '',
        email: c.email ?? '',
        phone: c.phone ?? '',
      }))
  }, [searchParams])

  const handleApplyCoupon = async () => {
    if (!couponCode.trim() || !product) return
    setCheckingCoupon(true)
    setCouponError('')
    try {
      const res = await fetch(`/api/pay/validate-coupon?code=${encodeURIComponent(couponCode)}&productId=${product.id}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setCouponId(data.id)
      setCouponDiscount(data.percentOff ? `${data.percentOff}% off` : data.amountOff ? `$${data.amountOff} off` : 'Applied')
    } catch {
      setCouponError('Coupon not valid')
    } finally {
      setCheckingCoupon(false)
    }
  }

  const handlePay = async () => {
    if (!product) return
    setRedirecting(true)
    setError('')
    try {
      const res = await fetch('/api/pay/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, contact, couponId }),
      })
      if (!res.ok) throw new Error(await res.text())
      const { sessionUrl } = await res.json()
      if (sessionUrl) {
        window.location.href = sessionUrl
      } else {
        throw new Error('No checkout URL returned')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start checkout. Try again.')
      setRedirecting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#0D1B2A] border-t-transparent animate-spin" />
      </div>
    )
  }

  if (notFound || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-4">
        <div>
          <p className="text-2xl font-bold text-gray-900">Product not found</p>
          <p className="text-gray-500 mt-2">This payment link may be expired or inactive.</p>
        </div>
      </div>
    )
  }

  const displayPrice = product.type === 'PAYMENT_PLAN' && product.planAmount ? product.planAmount : product.price

  return (
    <div className="min-h-screen bg-[#F8F9FA] py-12 px-4">
      {/* Header */}
      <div className="max-w-lg mx-auto mb-8 text-center">
        <div className="inline-block bg-[#0D1B2A] text-white rounded-xl px-4 py-2 text-sm font-bold tracking-wide mb-4">
          CRM
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
        {product.description && <p className="text-gray-500 mt-2">{product.description}</p>}
      </div>

      <div className="max-w-lg mx-auto space-y-4">
        {/* Price card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <p className="text-3xl font-bold text-gray-900">{formatPrice(displayPrice)}</p>
          {product.type === 'SUBSCRIPTION' && (
            <p className="text-sm text-gray-500 mt-1">
              per {product.interval === 'ANNUAL' ? 'year' : 'month'}
              {product.trialDays ? ` · ${product.trialDays}-day free trial` : ''}
            </p>
          )}
          {product.type === 'PAYMENT_PLAN' && product.planCount && product.planAmount && (
            <p className="text-sm text-gray-500 mt-1">
              {product.planCount} payments of {formatPrice(product.planAmount / product.planCount)}
              {' '}· {product.paymentFrequency?.toLowerCase()}
            </p>
          )}

          {/* Coupon */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            {couponDiscount ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-green-600 font-medium">✓ {couponDiscount} applied</span>
                <button onClick={() => { setCouponId(null); setCouponDiscount(''); setCouponCode('') }} className="text-xs text-gray-400 hover:text-gray-600">Remove</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Coupon code"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1B2A]/20"
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  disabled={checkingCoupon || !couponCode.trim()}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  {checkingCoupon ? '...' : 'Apply'}
                </button>
              </div>
            )}
            {couponError && <p className="text-xs text-red-500 mt-1">{couponError}</p>}
          </div>
        </div>

        {/* Step: info */}
        {step === 'info' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 mb-4">Your Information</p>
            <form
              onSubmit={(e) => { e.preventDefault(); setStep('review') }}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">First Name</label>
                  <input required value={contact.firstName} onChange={(e) => setContact((c) => ({ ...c, firstName: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1B2A]/20" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Last Name</label>
                  <input required value={contact.lastName} onChange={(e) => setContact((c) => ({ ...c, lastName: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1B2A]/20" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input type="email" required value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1B2A]/20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                <input type="tel" value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1B2A]/20" />
              </div>
              <button type="submit"
                className="w-full bg-[#0D1B2A] text-white rounded-xl py-3 text-sm font-semibold hover:bg-[#1B263B] transition-colors mt-1">
                Continue →
              </button>
            </form>
          </div>
        )}

        {/* Step: review + pay */}
        {step === 'review' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">Review & Pay</p>
              <button onClick={() => setStep('info')} className="text-xs text-gray-400 hover:text-gray-600">← Back</button>
            </div>

            {/* Contact summary */}
            <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600">
              <p className="font-medium text-gray-800">{contact.firstName} {contact.lastName}</p>
              <p>{contact.email}</p>
              {contact.phone && <p>{contact.phone}</p>}
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            {product.stripePriceId ? (
              <button
                onClick={handlePay}
                disabled={redirecting}
                className="w-full bg-[#0D1B2A] text-white rounded-xl py-3 text-sm font-semibold hover:bg-[#1B263B] disabled:opacity-40 transition-colors"
              >
                {redirecting ? 'Redirecting to checkout...' : `Pay ${formatPrice(displayPrice)}`}
              </button>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
                Stripe is not configured. Add your Stripe API keys to <code className="font-mono text-xs">.env</code> and create a product in Stripe to enable payments.
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-400">Secured by Stripe · Your payment info is never stored on our servers.</p>
      </div>
    </div>
  )
}
