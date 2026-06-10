'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Orbitron } from 'next/font/google'
import { loadStripe } from '@stripe/stripe-js'

const orbitron = Orbitron({ subsets: ['latin'], weight: ['700'] })
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]

const ELEMENT_OPTS = {
  style: {
    base: {
      fontSize: '14px',
      color: '#0F172A',
      fontFamily: '"Inter", system-ui, sans-serif',
      '::placeholder': { color: '#8a9bb0' },
    },
    invalid: { color: '#dc2626' },
  },
}

const fieldCls =
  'block w-full rounded-lg border border-[#c8cdd4] bg-white/70 px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#8a9bb0] outline-none transition-all duration-150 focus:border-[#415A77] focus:ring-2 focus:ring-[#415A77]/15 hover:border-[#415A77]/50'

const stripeWrapCls =
  'w-full rounded-lg border border-[#c8cdd4] bg-white/70 px-3 py-2 transition-all duration-150 focus-within:border-[#415A77] focus-within:ring-2 focus-within:ring-[#415A77]/15 hover:border-[#415A77]/50'

const lblCls = 'mb-1 block text-[10px] font-semibold tracking-widest text-[#5a6a7e] uppercase'

// ─── Card Form ────────────────────────────────────────────────────────────────

function CardForm({
  clientSecret,
  defaultName,
  companyId,
}: {
  clientSecret: string
  defaultName: string
  companyId: string
}) {
  const stripe   = useStripe()
  const elements = useElements()
  const router   = useRouter()

  const [name,    setName]    = useState(defaultName)
  const [email,   setEmail]   = useState('')
  const [phone,   setPhone]   = useState('')
  const [street,  setStreet]  = useState('')
  const [city,    setCity]    = useState('')
  const [state,   setState]   = useState('')
  const [zip,     setZip]     = useState('')
  const [country, setCountry] = useState('US')
  const [saving,   setSaving]   = useState(false)
  const [declined, setDeclined] = useState<string | null>(null)
  const [success,  setSuccess]  = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setDeclined(null)
    setSaving(true)

    const cardEl = elements.getElement(CardNumberElement)
    if (!cardEl) { setSaving(false); return }

    const { error: stripeErr } = await stripe.confirmCardSetup(clientSecret, {
      payment_method: {
        card: cardEl,
        billing_details: {
          name,
          email:   email  || undefined,
          phone:   phone  || undefined,
          address: {
            line1:       street || undefined,
            city:        city   || undefined,
            state:       state  || undefined,
            postal_code: zip    || undefined,
            country,
          },
        },
      },
    })

    if (stripeErr) {
      setDeclined(stripeErr.message ?? 'Card setup failed.')
      setSaving(false)
    } else {
      setSuccess(true)
      setTimeout(() => router.push(`/companies/${companyId}?tab=billing&card=added`), 1600)
    }
  }

  if (success) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 ring-1 ring-emerald-200">
          <svg className="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-[#0D1B2A]">Card saved</p>
        <p className="text-xs text-[#8a9bb0]">Redirecting…</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5">

      {/* ── Contact ── */}
      <div>
        <p className="mb-3 text-[10px] font-bold tracking-widest text-[#415A77] uppercase">Contact</p>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={lblCls}>Name <span className="text-red-400">*</span></label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" required className={fieldCls} />
            </div>
            <div>
              <label className={lblCls}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@co.com" className={fieldCls} />
            </div>
          </div>
          <div>
            <label className={lblCls}>Phone</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" className={fieldCls} />
          </div>
        </div>
      </div>

      {/* ── Billing Address ── */}
      <div>
        <p className="mb-3 text-[10px] font-bold tracking-widest text-[#415A77] uppercase">Billing Address</p>
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className={lblCls}>Street</label>
              <input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="123 Main St" className={fieldCls} />
            </div>
            <div>
              <label className={lblCls}>Country</label>
              <select value={country} onChange={(e) => setCountry(e.target.value)} className={fieldCls}>
                <option value="US">US</option>
                <option value="CA">CA</option>
                <option value="GB">UK</option>
                <option value="AU">AU</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={lblCls}>City</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="New York" className={fieldCls} />
            </div>
            <div>
              <label className={lblCls}>State</label>
              <select value={state} onChange={(e) => setState(e.target.value)} className={fieldCls}>
                <option value="">—</option>
                {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={lblCls}>ZIP</label>
              <input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="10001" className={fieldCls} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Card Details ── */}
      <div>
        <p className="mb-3 text-[10px] font-bold tracking-widest text-[#415A77] uppercase">Card Details</p>
        <div className="space-y-2">
          <div>
            <label className={lblCls}>Card Number <span className="text-red-400">*</span></label>
            <div className={stripeWrapCls}>
              <CardNumberElement options={{ ...ELEMENT_OPTS, showIcon: true }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={lblCls}>Expiration <span className="text-red-400">*</span></label>
              <div className={stripeWrapCls}>
                <CardExpiryElement options={ELEMENT_OPTS} />
              </div>
            </div>
            <div>
              <label className={lblCls}>CVC <span className="text-red-400">*</span></label>
              <div className={stripeWrapCls}>
                <CardCvcElement options={ELEMENT_OPTS} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Decline modal ── */}
      {declined && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeclined(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white px-6 py-7 shadow-2xl">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 ring-1 ring-red-100">
                <svg className="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <p className="text-base font-bold text-[#0D1B2A]">Card Declined</p>
                <p className="mt-1.5 text-sm text-[#64748b]">{declined}</p>
              </div>
              <button
                type="button"
                onClick={() => setDeclined(null)}
                className="mt-1 w-full rounded-lg bg-[#415A77] px-4 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-[#0D1B2A] focus:outline-none focus:ring-2 focus:ring-[#415A77] focus:ring-offset-2 cursor-pointer"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-auto space-y-3 pb-1">
        <button
          type="submit"
          disabled={saving || !stripe}
          className="w-full rounded-lg bg-[#415A77] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-[#0D1B2A] focus:outline-none focus:ring-2 focus:ring-[#415A77] focus:ring-offset-2 disabled:opacity-50 cursor-pointer"
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Saving…
            </span>
          ) : 'Save Card'}
        </button>
        <p className="text-center text-[11px] text-[#8a9bb0]">
          Secured by <span className="font-medium text-[#415A77]">Stripe</span> · PCI DSS compliant
        </p>
      </div>
    </form>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function AddCardPageInner({ params }: { params: { companyId: string } }) {
  const searchParams = useSearchParams()
  const companyName  = searchParams.get('name') ?? ''

  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [fetchError,   setFetchError]   = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/companies/${params.companyId}/billing/setup-intent`, { method: 'POST' })
      .then(async (res) => {
        const data = await res.json()
        if (data.clientSecret) setClientSecret(data.clientSecret)
        else setFetchError(data.error ?? 'Failed to initialize.')
      })
      .catch(() => setFetchError('Network error. Please try again.'))
  }, [params.companyId])

  return (
    <div className="flex h-screen w-full overflow-hidden">

      {/* ── Left: Brand panel ── */}
      <div
        className="relative hidden lg:flex lg:w-[42%] xl:w-[45%] flex-col overflow-hidden"
        style={{ backgroundColor: '#415A77' }}
      >
        {/* Oversized logo bleeds off top and right — only logo, no second layer */}
        <div className="relative flex-1 overflow-hidden">
          <img
            src="/jf-logo-icon.png"
            alt=""
            aria-hidden="true"
            className="absolute select-none pointer-events-none"
            style={{
              width: '145%',
              maxWidth: 'none',
              opacity: 0.55,
              top: '-8%',
              left: '-12%',
            }}
          />
        </div>

        {/* Purple divider — matches mockup */}
        <div className="h-px w-full" style={{ backgroundColor: '#7B68EE' }} />

        {/* JF Digital in Orbitron */}
        <div className="px-8 py-8">
          <p
            className={`${orbitron.className} text-4xl font-bold leading-tight select-none`}
            style={{ color: '#E0E1DD' }}
          >
            JF Digital
          </p>
        </div>
      </div>

      {/* ── Right: Form panel ── */}
      <div
        className="flex flex-1 flex-col overflow-hidden"
        style={{ backgroundColor: '#E0E1DD' }}
      >
        {/* Mobile logo bar */}
        <div className="flex items-center gap-3 border-b border-[#415A77]/10 bg-[#415A77] px-6 py-4 lg:hidden">
          <img src="/jf-logo-icon.png" alt="JF Digital" className="h-7 w-7 brightness-0 invert" />
          <span className="text-sm font-bold tracking-wider text-white uppercase">JF Digital</span>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden px-10 py-8">
          <div className="mb-6 shrink-0">
            <h1 className="text-2xl font-bold tracking-tight text-[#0D1B2A]">Add a card on file</h1>
            {companyName && (
              <p className="mt-1 text-sm text-[#5a6a7e]">
                For <span className="font-semibold text-[#415A77]">{companyName}</span>
              </p>
            )}
          </div>

          {fetchError ? (
            <div className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3.5 py-3">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-600">{fetchError}</p>
            </div>
          ) : !clientSecret ? (
            <div className="flex flex-1 items-center justify-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#415A77] border-t-transparent" />
              <p className="text-sm text-[#8a9bb0]">Loading secure form…</p>
            </div>
          ) : (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CardForm
                clientSecret={clientSecret}
                defaultName={companyName}
                companyId={params.companyId}
              />
            </Elements>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AddCardPage({ params }: { params: { companyId: string } }) {
  return (
    <Suspense fallback={null}>
      <AddCardPageInner params={params} />
    </Suspense>
  )
}
