'use client'

export const dynamic = 'force-dynamic'

import React, { useEffect, useState, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

interface Product {
  name: string
  price: number
  type: string
}

function PaySuccessPageInner() {
  const params = useParams<{ productId: string }>()
  const searchParams = useSearchParams()
  const [product, setProduct] = useState<Product | null>(null)

  useEffect(() => {
    fetch(`/api/products/${params.productId}/public`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setProduct(data) })
  }, [params.productId])

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
          <CheckCircle2 size={36} className="text-green-600" />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Successful!</h1>
          {product && (
            <p className="text-gray-500 mt-2">
              You&apos;re all set for <strong>{product.name}</strong>.
              {product.type === 'ONE_TIME' && ` Thank you for your purchase of ${formatPrice(product.price)}.`}
              {product.type === 'SUBSCRIPTION' && ` Your subscription is now active.`}
              {product.type === 'PAYMENT_PLAN' && ` Your payment plan has started.`}
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 text-left space-y-2">
          <p className="text-sm font-semibold text-gray-700">What happens next</p>
          <ul className="text-sm text-gray-500 space-y-1.5">
            <li>✓ A receipt has been sent to your email</li>
            <li>✓ You will receive access details shortly</li>
            {product?.type === 'SUBSCRIPTION' && (
              <li>✓ You can manage your subscription via the customer portal</li>
            )}
          </ul>
        </div>

        <p className="text-xs text-gray-400">Need help? Reply to your receipt email.</p>
      </div>
    </div>
  )
}

export default function PaySuccessPage() {
  return (
    <Suspense fallback={null}>
      <PaySuccessPageInner />
    </Suspense>
  )
}
