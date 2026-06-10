'use client'

import React, { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { Modal } from '@/components/ui/modal'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

const ELEMENT_STYLE = {
  style: {
    base: {
      fontSize: '14px',
      color: '#111827',
      fontFamily: 'inherit',
      '::placeholder': { color: '#9ca3af' },
    },
    invalid: { color: '#ef4444' },
  },
}

const inputClass =
  'w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/20 transition-colors placeholder:text-gray-400'

const stripeWrapClass =
  'w-full rounded-lg border border-gray-200 px-3 py-2.5 focus-within:border-[#415A77] focus-within:ring-2 focus-within:ring-[#415A77]/20 transition-colors'

// ─── Inner form ───────────────────────────────────────────────────────────────

function CardForm({
  clientSecret,
  defaultName,
  defaultEmail,
  onSuccess,
  onClose,
}: {
  clientSecret: string
  defaultName: string
  defaultEmail: string
  onSuccess: () => void
  onClose: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()

  const [name, setName] = useState(defaultName)
  const [email, setEmail] = useState(defaultEmail)
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setError(null)
    setSaving(true)

    const cardNumber = elements.getElement(CardNumberElement)
    if (!cardNumber) { setSaving(false); return }

    const { error: stripeError } = await stripe.confirmCardSetup(clientSecret, {
      payment_method: {
        card: cardNumber,
        billing_details: {
          name,
          email: email || undefined,
          phone: phone || undefined,
          address: {
            line1: address || undefined,
            city: city || undefined,
            state: state || undefined,
            postal_code: zip || undefined,
          },
        },
      },
    })

    if (stripeError) {
      setError(stripeError.message ?? 'Card setup failed.')
      setSaving(false)
    } else {
      onSuccess()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">

      {/* ── Billing Information ── */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Billing Information</p>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Full Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" required className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@company.com" className={inputClass} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Address</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" className={inputClass} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">City</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="New York" className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">State</label>
              <input value={state} onChange={(e) => setState(e.target.value)} placeholder="NY" className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">ZIP</label>
              <input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="10001" className={inputClass} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Card Details ── */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Card Details</p>
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Card Number</label>
            <div className={stripeWrapClass}>
              <CardNumberElement options={ELEMENT_STYLE} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Expiration</label>
              <div className={stripeWrapClass}>
                <CardExpiryElement options={ELEMENT_STYLE} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">CVV</label>
              <div className={stripeWrapClass}>
                <CardCvcElement options={ELEMENT_STYLE} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !stripe}
          className="flex-1 rounded-lg bg-[#0D1B2A] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1B263B] transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Card'}
        </button>
      </div>
    </form>
  )
}

// ─── Outer modal ──────────────────────────────────────────────────────────────

export function AddCardModal({
  open,
  companyId,
  companyName,
  onClose,
  onSuccess,
}: {
  open: boolean
  companyId: string
  companyName?: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) { setClientSecret(null); setFetchError(null); return }

    fetch(`/api/companies/${companyId}/billing/setup-intent`, { method: 'POST' })
      .then(async (res) => {
        const data = await res.json()
        if (data.clientSecret) setClientSecret(data.clientSecret)
        else setFetchError(data.error ?? 'Failed to initialize card form.')
      })
      .catch(() => setFetchError('Network error. Please try again.'))
  }, [open, companyId])

  return (
    <Modal open={open} onClose={onClose} title="Add Card" size="md">
      {fetchError ? (
        <p className="text-sm text-red-600">{fetchError}</p>
      ) : !clientSecret ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#415A77] border-t-transparent" />
        </div>
      ) : (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <CardForm
            clientSecret={clientSecret}
            defaultName={companyName ?? ''}
            defaultEmail=""
            onSuccess={onSuccess}
            onClose={onClose}
          />
        </Elements>
      )}
    </Modal>
  )
}
