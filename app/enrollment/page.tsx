'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Orbitron } from 'next/font/google'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'

const orbitron = Orbitron({ subsets: ['latin'], weight: ['700'] })
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

type ExistingCompany = { id: string; name: string }
type Product = { id: string; name: string; price: number; type: string }
type ServiceLine = {
  uid: string
  productId: string
  amount: string
  chargeType: 'deposit' | 'on_completion' | 'recurring'
}

function newLine(): ServiceLine {
  return { uid: Math.random().toString(36).slice(2), productId: '', amount: '', chargeType: 'deposit' }
}

const CHARGE_TYPES: { value: ServiceLine['chargeType']; label: string; short: string }[] = [
  { value: 'deposit',       label: 'Deposit',       short: 'today'      },
  { value: 'on_completion', label: 'On Completion',  short: 'on complete'},
  { value: 'recurring',     label: 'Recurring',      short: '/mo'        },
]

// ─── Enrollment Form ──────────────────────────────────────────────────────────

function EnrollmentForm() {
  const stripe   = useStripe()
  const elements = useElements()
  const router   = useRouter()

  const [companyName, setCompanyName] = useState('')
  const [firstName,   setFirstName]   = useState('')
  const [lastName,    setLastName]    = useState('')
  const [email,       setEmail]       = useState('')
  const [phone,       setPhone]       = useState('')
  const [street,      setStreet]      = useState('')
  const [city,        setCity]        = useState('')
  const [state,       setState]       = useState('')
  const [zip,         setZip]         = useState('')
  const [country,     setCountry]     = useState('US')

  const [saving,        setSaving]        = useState(false)
  const [declined,      setDeclined]      = useState<string | null>(null)
  const [success,       setSuccess]       = useState(false)
  const [mergeTarget,   setMergeTarget]   = useState<ExistingCompany | null>(null)
  const [showMerge,     setShowMerge]     = useState(false)

  // Services
  const [services,  setServices]  = useState<ServiceLine[]>([])
  const [products,  setProducts]  = useState<Product[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((d) => setProducts(d.products ?? []))
      .catch(() => {})
  }, [])

  const addService = () => setServices((prev) => [...prev, newLine()])

  const updateService = (uid: string, patch: Partial<ServiceLine>) => {
    setServices((prev) => prev.map((s) => s.uid === uid ? { ...s, ...patch } : s))
  }

  const removeService = (uid: string) => setServices((prev) => prev.filter((s) => s.uid !== uid))

  const depositTotal    = services.filter((s) => s.chargeType === 'deposit').reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0)
  const completionTotal = services.filter((s) => s.chargeType === 'on_completion').reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0)
  const recurringLines  = services.filter((s) => s.chargeType === 'recurring')
  const recurringTotal  = recurringLines.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0)

  // ── Duplicate check ───────────────────────────────────────────────────────

  const checkDuplicate = useCallback(async (name: string) => {
    if (name.trim().length < 2) { setMergeTarget(null); return }
    try {
      const res = await fetch(`/api/companies?typeahead=true&search=${encodeURIComponent(name.trim())}`)
      const data = await res.json()
      const companies: ExistingCompany[] = Array.isArray(data) ? data : (data.companies ?? [])
      const exact = companies.find((c) => c.name.toLowerCase() === name.trim().toLowerCase())
      setMergeTarget(exact ?? null)
    } catch {
      setMergeTarget(null)
    }
  }, [])

  const handleCompanyNameChange = (val: string) => {
    setCompanyName(val)
    setMergeTarget(null)
    setShowMerge(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => checkDuplicate(val), 400)
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  const doSubmit = async (existingCompanyId?: string) => {
    if (!stripe || !elements) return
    setDeclined(null)
    setSaving(true)

    const cardEl = elements.getElement(CardNumberElement)
    if (!cardEl) { setSaving(false); return }

    const { paymentMethod, error: pmErr } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardEl,
      billing_details: {
        name: firstName ? `${firstName} ${lastName}`.trim() : companyName,
        email:   email  || undefined,
        phone:   phone  || undefined,
        address: {
          line1:       street  || undefined,
          city:        city    || undefined,
          state:       state   || undefined,
          postal_code: zip     || undefined,
          country,
        },
      },
    })

    if (pmErr) {
      setDeclined(pmErr.message ?? 'Your card was declined.')
      setSaving(false)
      return
    }

    const res = await fetch('/api/enrollment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName,
        firstName,
        lastName,
        email,
        phone,
        street,
        city,
        state,
        zip,
        country,
        paymentMethodId: paymentMethod?.id,
        existingCompanyId,
        services: services
          .filter((s) => s.productId && (parseFloat(s.amount) || 0) > 0)
          .map((s) => ({ productId: s.productId, amount: parseFloat(s.amount) || 0, chargeType: s.chargeType })),
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setDeclined(data.error ?? 'Enrollment failed. Please try again.')
      setSaving(false)
    } else {
      setSuccess(true)
      setTimeout(() => router.push(`/companies/${data.companyId}`), 1600)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mergeTarget && !showMerge) {
      setShowMerge(true)
      return
    }
    await doSubmit(undefined)
  }

  const handleMergeYes = async () => {
    if (!mergeTarget) return
    setShowMerge(false)
    await doSubmit(mergeTarget.id)
  }

  const handleMergeNo = async () => {
    setShowMerge(false)
    await doSubmit(undefined)
  }

  // ── Success ───────────────────────────────────────────────────────────────

  if (success) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 ring-1 ring-emerald-200">
          <svg className="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-[#0D1B2A]">Client enrolled</p>
        <p className="text-xs text-[#8a9bb0]">Redirecting to company profile…</p>
      </div>
    )
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5">

        {/* ── Company ── */}
        <div>
          <p className="mb-3 text-[10px] font-bold tracking-widest text-[#415A77] uppercase">Company</p>
          <div>
            <label className={lblCls}>Company Name <span className="text-red-400">*</span></label>
            <input
              value={companyName}
              onChange={(e) => handleCompanyNameChange(e.target.value)}
              placeholder="Acme Corp"
              required
              className={fieldCls}
            />
            {mergeTarget && !showMerge && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600">
                <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Existing company found — you'll be asked to merge on submit.
              </p>
            )}
          </div>
        </div>

        {/* ── Primary Contact ── */}
        <div>
          <p className="mb-3 text-[10px] font-bold tracking-widest text-[#415A77] uppercase">Primary Contact</p>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={lblCls}>First Name</label>
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" className={fieldCls} />
              </div>
              <div>
                <label className={lblCls}>Last Name</label>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Smith" className={fieldCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={lblCls}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@co.com" className={fieldCls} />
              </div>
              <div>
                <label className={lblCls}>Phone</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" className={fieldCls} />
              </div>
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

        {/* ── Services ── */}
        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <p className="text-[10px] font-bold tracking-widest text-[#415A77] uppercase">Services</p>
            <button
              type="button"
              onClick={addService}
              className="flex items-center gap-1 text-[10px] font-semibold tracking-wide text-[#415A77] uppercase opacity-70 hover:opacity-100 transition-opacity"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add
            </button>
          </div>

          {services.length === 0 ? (
            <p className="text-xs text-[#8a9bb0]">No services — enrollment saves payment on file only.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[#415A77]/15 bg-white/40 divide-y divide-[#415A77]/10">
              {services.map((svc) => (
                <div key={svc.uid} className="flex items-center gap-3 px-4 py-3">
                  {/* Product */}
                  <select
                    value={svc.productId}
                    onChange={(e) => {
                      const p = products.find((pr) => pr.id === e.target.value)
                      updateService(svc.uid, { productId: e.target.value, amount: p ? String(p.price) : svc.amount })
                    }}
                    className="flex-1 min-w-0 bg-transparent text-sm font-medium text-[#0D1B2A] outline-none cursor-pointer truncate"
                  >
                    <option value="">— Product —</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>

                  {/* Amount */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <span className="text-sm text-[#8a9bb0]">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={svc.amount}
                      onChange={(e) => updateService(svc.uid, { amount: e.target.value })}
                      className="w-20 bg-transparent text-sm font-semibold text-[#0D1B2A] outline-none text-right"
                      placeholder="0.00"
                    />
                  </div>

                  {/* Charge type pills */}
                  <div className="flex shrink-0 rounded-lg border border-[#c8cdd4] bg-white/60 overflow-hidden">
                    {CHARGE_TYPES.map((ct) => (
                      <button
                        key={ct.value}
                        type="button"
                        onClick={() => updateService(svc.uid, { chargeType: ct.value })}
                        className={
                          svc.chargeType === ct.value
                            ? 'px-2.5 py-1 text-[10px] font-semibold bg-[#415A77] text-white transition-colors'
                            : 'px-2.5 py-1 text-[10px] font-medium text-[#5a6a7e] hover:bg-[#415A77]/5 transition-colors'
                        }
                      >
                        {ct.label}
                      </button>
                    ))}
                  </div>

                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() => removeService(svc.uid)}
                    className="shrink-0 text-[#8a9bb0] hover:text-red-400 transition-colors"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Payment ── */}
        <div>
          <p className="mb-3 text-[10px] font-bold tracking-widest text-[#415A77] uppercase">Payment</p>
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
                  <p className="text-base font-bold text-[#0D1B2A]">Payment Declined</p>
                  <p className="mt-1.5 text-sm text-[#64748b]">{declined}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeclined(null)}
                  className="mt-1 w-full rounded-lg bg-[#415A77] px-4 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-[#0D1B2A] cursor-pointer"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Merge modal ── */}
        {showMerge && mergeTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative w-full max-w-sm rounded-2xl bg-white px-6 py-7 shadow-2xl">
              <div className="flex flex-col gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 ring-1 ring-amber-100">
                  <svg className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-base font-bold text-[#0D1B2A]">Existing company found</p>
                  <p className="mt-1.5 text-sm text-[#64748b]">
                    <span className="font-semibold text-[#415A77]">{mergeTarget.name}</span> already exists in the CRM.
                    Would you like to merge this enrollment into the existing company?
                  </p>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleMergeNo}
                    disabled={saving}
                    className="flex-1 rounded-lg border border-[#c8cdd4] bg-white px-4 py-2.5 text-sm font-semibold text-[#0D1B2A] transition-all duration-150 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
                  >
                    Create New
                  </button>
                  <button
                    type="button"
                    onClick={handleMergeYes}
                    disabled={saving}
                    className="flex-1 rounded-lg bg-[#415A77] px-4 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-[#0D1B2A] disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? 'Enrolling…' : 'Merge'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-auto space-y-2 pb-1">
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
                Enrolling…
              </span>
            ) : depositTotal > 0 ? `Enroll & Charge $${depositTotal.toFixed(2)}` : 'Enroll Client'}
          </button>

          {(completionTotal > 0 || recurringTotal > 0) && (
            <div className="rounded-lg border border-[#415A77]/10 bg-[#415A77]/5 px-3 py-2 space-y-0.5">
              {completionTotal > 0 && (
                <p className="text-center text-[11px] text-[#415A77]">
                  On completion: <span className="font-semibold">${completionTotal.toFixed(2)}</span>
                </p>
              )}
              {recurringTotal > 0 && (
                <p className="text-center text-[11px] text-[#415A77]">
                  Monthly retainer: <span className="font-semibold">${recurringTotal.toFixed(2)}/mo</span>
                  <span className="text-[#5a6a7e]"> · start date set at completion</span>
                </p>
              )}
            </div>
          )}

          <p className="text-center text-[11px] text-[#8a9bb0]">
            Secured by <span className="font-medium text-[#415A77]">Stripe</span> · PCI DSS compliant
          </p>
        </div>
      </form>
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EnrollmentPage() {
  return (
    <div className="flex h-screen w-full overflow-hidden">

      {/* ── Left: Brand panel ── */}
      <div
        className="relative hidden lg:flex lg:w-[42%] xl:w-[45%] flex-col overflow-hidden"
        style={{ backgroundColor: '#415A77' }}
      >
        <div className="relative flex-1 overflow-hidden">
          <img
            src="/jf-logo-icon.png"
            alt=""
            aria-hidden="true"
            className="absolute select-none pointer-events-none"
            style={{ width: '145%', maxWidth: 'none', opacity: 0.55, top: '-8%', left: '-12%' }}
          />
        </div>

        <div className="h-px w-full" style={{ backgroundColor: '#7B68EE' }} />

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
        <div className="flex items-center gap-3 border-b border-[#415A77]/10 bg-[#415A77] px-6 py-4 lg:hidden">
          <img src="/jf-logo-icon.png" alt="JF Digital" className="h-7 w-7 brightness-0 invert" />
          <span className="text-sm font-bold tracking-wider text-white uppercase">JF Digital</span>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto px-10 py-8">
          <div className="mb-5 shrink-0">
            <a
              href="/dashboard"
              className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium transition-colors hover:text-[#0D1B2A]"
              style={{ color: '#415A77' }}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </a>
            <h1 className="text-2xl font-bold tracking-tight text-[#0D1B2A]">Client Enrollment</h1>
            <p className="mt-1 text-sm text-[#5a6a7e]">Create a new client account and save payment on file.</p>
          </div>

          <Elements stripe={stripePromise}>
            <EnrollmentForm />
          </Elements>
        </div>
      </div>
    </div>
  )
}
