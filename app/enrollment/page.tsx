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
type Product = {
  id: string; name: string; price: number; type: string
  price6Month?: number | null
  price12Month?: number | null
  price18Month?: number | null
}
type ServiceLine = {
  uid: string
  productId: string
  amount: string
  chargeType: 'deposit' | 'on_completion' | 'recurring'
  durationMonths: number | null
  baseFee?: number
}

function newLine(): ServiceLine {
  return { uid: Math.random().toString(36).slice(2), productId: '', amount: '', chargeType: 'deposit', durationMonths: null }
}

function calcTiers(base: number) {
  return {
    price6:  base,
    price12: parseFloat((base * 0.85).toFixed(2)),
    price18: parseFloat((base * 0.75).toFixed(2)),
  }
}

function fmtMoney(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
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

  // Lifetime mode
  const [lifetimeMode,       setLifetimeMode]       = useState(false)
  const lifetimeMultiplier = 3

  // Setup modal
  const [showSetup, setShowSetup] = useState(false)
  const [setupDeposit,   setSetupDeposit]   = useState({ amount: '' })
  const [setupCompletion,setSetupCompletion]= useState({ amount: '' })
  const [setupBaseFee,   setSetupBaseFee]   = useState('')
  // Savings calculator
  const [calcSavings,    setCalcSavings]    = useState('')
  const [calcSetupPct,   setCalcSetupPct]   = useState<10 | 12 | 15>(12)
  const [calcRetainerPct,setCalcRetainerPct]= useState<1 | 1.2 | 1.5>(1.2)

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
        services: lifetimeMode ? (() => {
            const recurringLine = services.find((s) => s.chargeType === 'recurring')
            const base = recurringLine?.baseFee ?? 0
            const tiers = base > 0 ? calcTiers(base) : null
            const retainer18Total = tiers ? tiers.price18 * 18 : 0
            const lifetimePrice = Math.round(retainer18Total * lifetimeMultiplier)
            const productId = recurringLine?.productId || services[0]?.productId || ''
            return productId && lifetimePrice > 0
              ? [{ productId, amount: lifetimePrice, chargeType: 'deposit' as const, durationMonths: undefined }]
              : []
          })() : services
          .filter((s) => s.productId && (parseFloat(s.amount) || 0) > 0)
          .map((s) => ({ productId: s.productId, amount: parseFloat(s.amount) || 0, chargeType: s.chargeType, durationMonths: s.durationMonths ?? undefined })),
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
            <div className="flex items-center gap-3">
              <p className="text-[10px] font-bold tracking-widest text-[#415A77] uppercase">Services</p>
              {/* Lifetime toggle */}
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={lifetimeMode} onChange={(e) => setLifetimeMode(e.target.checked)} />
                  <div className={`w-7 h-4 rounded-full transition-colors duration-200 ${lifetimeMode ? 'bg-[#415A77]' : 'bg-gray-200'}`} />
                  <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform duration-200 ${lifetimeMode ? 'translate-x-3' : 'translate-x-0'}`} />
                </div>
                <span className="text-[10px] font-semibold tracking-wide text-[#415A77] uppercase opacity-80">Lifetime</span>
              </label>
            </div>
            <button
              type="button"
              onClick={() => setShowSetup(true)}
              className="flex items-center gap-1 text-[10px] font-semibold tracking-wide text-[#415A77] uppercase opacity-70 hover:opacity-100 transition-opacity"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Setup
            </button>
          </div>

          {/* ── Setup modal ── */}
          {showSetup && (() => {
            const base = parseFloat(setupBaseFee) || 0
            const tiers = base > 0 ? calcTiers(base) : null

            function applySetup() {
              const oneTimeProduct = products.find((p) => p.type !== 'SUBSCRIPTION') ?? products[0]
              const recurringProduct = products.find((p) => p.type === 'SUBSCRIPTION') ?? products[0]
              const lines: ServiceLine[] = []
              if (parseFloat(setupDeposit.amount) > 0 && oneTimeProduct) {
                lines.push({ uid: Math.random().toString(36).slice(2), productId: oneTimeProduct.id, chargeType: 'deposit', amount: setupDeposit.amount, durationMonths: null })
              }
              if (parseFloat(setupCompletion.amount) > 0 && oneTimeProduct) {
                lines.push({ uid: Math.random().toString(36).slice(2), productId: oneTimeProduct.id, chargeType: 'on_completion', amount: setupCompletion.amount, durationMonths: null })
              }
              if (tiers && recurringProduct) {
                lines.push({ uid: Math.random().toString(36).slice(2), productId: recurringProduct.id, chargeType: 'recurring', durationMonths: 18, amount: String(tiers.price18), baseFee: base })
              }
              setServices(lines)
              setShowSetup(false)
            }

            const SectionLabel = ({ children }: { children: React.ReactNode }) => (
              <p className="text-[10px] font-bold tracking-widest text-[#415A77] uppercase mb-2">{children}</p>
            )

            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowSetup(false)}>
                <div className="bg-white rounded-2xl shadow-2xl w-[520px] max-h-[90vh] overflow-y-auto p-6 mx-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-bold text-[#0D1B2A]">Service Setup</h3>
                    <button type="button" onClick={() => setShowSetup(false)} className="text-[#8a9bb0] hover:text-[#415A77]">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* ── Savings Calculator ── */}
                  {(() => {
                    const savings = parseFloat(calcSavings) || 0
                    const setupFee = savings > 0 ? Math.round(savings * calcSetupPct / 100) : 0
                    const half = Math.round(setupFee / 2)
                    const retainerBase = savings > 0 ? Math.round(savings * calcRetainerPct / 100) : 0
                    const canApply = savings > 0
                    return (
                      <div className="mb-5 p-4 rounded-xl border-2 border-[#415A77]/20 bg-[#415A77]/[0.04]">
                        <p className="text-[10px] font-bold tracking-widest text-[#415A77] uppercase mb-3">Savings Calculator</p>
                        <div className="mb-3">
                          <label className="mb-1 block text-[10px] font-medium text-gray-500">Annual Savings ($)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8a9bb0]">$</span>
                            <input type="number" min="0" step="100" placeholder="0" value={calcSavings}
                              onChange={(e) => setCalcSavings(e.target.value)}
                              className={fieldCls + ' pl-6'} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <label className="mb-1.5 block text-[10px] font-medium text-gray-500">Setup Fee %</label>
                            <div className="flex rounded-lg border border-[#415A77]/20 overflow-hidden">
                              {([10, 12, 15] as const).map((p) => (
                                <button key={p} type="button" onClick={() => setCalcSetupPct(p)}
                                  className={`flex-1 py-1.5 text-[11px] font-bold transition-colors ${calcSetupPct === p ? 'bg-[#415A77] text-white' : 'text-[#5a6a7e] hover:bg-[#415A77]/5 bg-white'}`}>
                                  {p}%
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="mb-1.5 block text-[10px] font-medium text-gray-500">Retainer %/mo</label>
                            <div className="flex rounded-lg border border-[#415A77]/20 overflow-hidden">
                              {([1, 1.2, 1.5] as const).map((p) => (
                                <button key={p} type="button" onClick={() => setCalcRetainerPct(p)}
                                  className={`flex-1 py-1.5 text-[11px] font-bold transition-colors ${calcRetainerPct === p ? 'bg-[#415A77] text-white' : 'text-[#5a6a7e] hover:bg-[#415A77]/5 bg-white'}`}>
                                  {p}%
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        {canApply && (
                          <div className="mb-3 rounded-lg bg-white border border-[#415A77]/15 divide-y divide-[#415A77]/10 text-xs">
                            <div className="flex justify-between px-3 py-2">
                              <span className="text-[#8a9bb0]">Setup fee ({calcSetupPct}%)</span>
                              <span className="font-bold text-[#0D1B2A]">${setupFee.toLocaleString()} <span className="font-normal text-[#8a9bb0]">(${half.toLocaleString()} + ${half.toLocaleString()})</span></span>
                            </div>
                            <div className="flex justify-between px-3 py-2">
                              <span className="text-[#8a9bb0]">Retainer base ({calcRetainerPct}%/mo)</span>
                              <span className="font-bold text-[#0D1B2A]">${retainerBase.toLocaleString()}/mo</span>
                            </div>
                            <div className="flex justify-between px-3 py-2">
                              <span className="text-[#8a9bb0]">Client 10× ROI check</span>
                              <span className={`font-bold ${savings >= (setupFee + retainerBase * 18) * 10 / 10 ? 'text-emerald-600' : 'text-[#0D1B2A]'}`}>
                                {setupFee + retainerBase * 18 > 0 ? `${(savings / (setupFee + retainerBase * 18)).toFixed(1)}× year-one` : '—'}
                              </span>
                            </div>
                          </div>
                        )}
                        <button type="button" disabled={!canApply}
                          onClick={() => {
                            setSetupDeposit((d) => ({ ...d, amount: String(half) }))
                            setSetupCompletion((d) => ({ ...d, amount: String(half) }))
                            setSetupBaseFee(String(retainerBase))
                          }}
                          className="w-full py-2 rounded-lg text-[11px] font-bold tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-[#415A77] text-white hover:bg-[#0D1B2A]">
                          Apply Calculated Amounts ↓
                        </button>
                      </div>
                    )
                  })()}

                  {/* ── Upfront Charge ── */}
                  <div className="mb-5 p-4 rounded-xl border border-[#415A77]/15 bg-[#f8fafc]">
                    <SectionLabel>Upfront Charge</SectionLabel>
                    <div>
                      <label className={lblCls}>Amount</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8a9bb0]">$</span>
                        <input type="number" min="0" step="0.01" placeholder="0.00" value={setupDeposit.amount}
                          onChange={(e) => setSetupDeposit((d) => ({ ...d, amount: e.target.value }))}
                          className={fieldCls + ' pl-6'} />
                      </div>
                    </div>
                  </div>

                  {/* ── Upon Completion ── */}
                  <div className="mb-5 p-4 rounded-xl border border-[#415A77]/15 bg-[#f8fafc]">
                    <SectionLabel>Upon Completion</SectionLabel>
                    <div>
                      <label className={lblCls}>Amount</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8a9bb0]">$</span>
                        <input type="number" min="0" step="0.01" placeholder="0.00" value={setupCompletion.amount}
                          onChange={(e) => setSetupCompletion((d) => ({ ...d, amount: e.target.value }))}
                          className={fieldCls + ' pl-6'} />
                      </div>
                    </div>
                  </div>

                  {/* ── Monthly Retainer ── */}
                  <div className="mb-6 p-4 rounded-xl border border-[#415A77]/15 bg-[#f8fafc]">
                    <SectionLabel>Monthly Retainer</SectionLabel>
                    <div className="mb-3">
                      <label className={lblCls}>Base Monthly Fee</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8a9bb0]">$</span>
                        <input type="number" min="0" step="0.01" value={setupBaseFee}
                          onChange={(e) => setSetupBaseFee(e.target.value)}
                          placeholder="0.00" className={fieldCls + ' pl-6'} />
                      </div>
                      <p className="text-[10px] text-[#8a9bb0] mt-1">6 mo = base · 12 mo = 15% off · 18 mo = 25% off</p>
                    </div>

                    {tiers && (
                      <div className="rounded-lg border border-[#415A77]/15 overflow-hidden">
                        {([
                          { months: 6,  label: '6 Months',  price: tiers.price6,  discount: null },
                          { months: 12, label: '12 Months', price: tiers.price12, discount: 15 },
                          { months: 18, label: '18 Months', price: tiers.price18, discount: 25 },
                        ] as const).map((tier, i) => (
                          <div key={tier.months} className={`flex items-center justify-between px-3 py-2.5 ${i > 0 ? 'border-t border-[#415A77]/10' : ''} ${tier.months === 18 ? 'bg-[#415A77]/5' : ''}`}>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-[#0D1B2A]">{tier.label}</span>
                              {tier.discount && <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 rounded px-1.5 py-0.5">{tier.discount}% off</span>}
                              {tier.months === 18 && <span className="text-[10px] font-semibold text-[#415A77] bg-[#415A77]/10 rounded px-1.5 py-0.5">Default</span>}
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-[#0D1B2A]">${fmtMoney(tier.price)}<span className="text-xs font-normal text-[#8a9bb0]">/mo</span></p>
                              <p className="text-[10px] text-[#8a9bb0]">${fmtMoney(tier.price * tier.months)} total</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={applySetup}
                    className="w-full bg-[#415A77] hover:bg-[#0D1B2A] text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
                  >
                    Apply to Enrollment
                  </button>
                </div>
              </div>
            )
          })()}

          {services.length === 0 ? (
            <p className="text-xs text-[#8a9bb0]">No services added — click Setup to configure.</p>
          ) : lifetimeMode ? (() => {
            const recurringLine = services.find((s) => s.chargeType === 'recurring')
            const base = recurringLine?.baseFee ?? 0
            const tiers = base > 0 ? calcTiers(base) : null
            const retainer18Total = tiers ? tiers.price18 * 18 : 0
            const lifetimePrice = Math.round(retainer18Total * lifetimeMultiplier)

            return (
              <div className="rounded-xl border-2 border-[#415A77]/30 bg-[#415A77]/5 px-4 py-4 relative overflow-hidden">
                {/* background shimmer accent */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#415A77]/5 to-transparent pointer-events-none" />
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold tracking-widest text-[#415A77] uppercase">Lifetime Access</span>
                      <span className="text-[10px] font-bold text-white bg-[#415A77] rounded px-1.5 py-0.5">One-Time</span>
                    </div>
                  </div>

                  <p className="text-3xl font-bold text-[#0D1B2A] mb-1">${fmtMoney(lifetimePrice)}</p>
                  <p className="text-xs text-[#8a9bb0]">one-time payment · never charged again</p>

                  {retainer18Total > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#415A77]/15">
                      <p className="text-[11px] text-[#8a9bb0]">
                        Based on {lifetimeMultiplier}× your 18-month retainer total of ${fmtMoney(retainer18Total)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )
          })() : (() => {
            const depositLine    = services.find((s) => s.chargeType === 'deposit')
            const completionLine = services.find((s) => s.chargeType === 'on_completion')
            const recurringLine  = services.find((s) => s.chargeType === 'recurring')
            const hasSetup       = depositLine || completionLine

            const GearBtn = ({ onClick }: { onClick: () => void }) => (
              <button type="button" onClick={onClick} className="text-[#8a9bb0] hover:text-[#415A77] transition-colors">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            )

            const XBtn = ({ onClick }: { onClick: () => void }) => (
              <button type="button" onClick={onClick} className="text-[#8a9bb0] hover:text-red-400 transition-colors">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )

            return (
              <div className="space-y-3">

                {/* ── Setup Charge card ── */}
                {hasSetup && (() => {
                  const dep = parseFloat(depositLine?.amount || '0')
                  const com = parseFloat(completionLine?.amount || '0')
                  const total = dep + com
                  return (
                    <div className="rounded-xl border border-[#415A77]/15 bg-white/40 px-4 py-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold tracking-widest text-[#415A77] uppercase">Setup Charge</span>
                        <GearBtn onClick={() => setShowSetup(true)} />
                      </div>
                      <p className="text-2xl font-bold text-[#0D1B2A] mb-1">${fmtMoney(total)}</p>
                      <div className="flex items-center gap-1.5 text-xs text-[#8a9bb0]">
                        {depositLine    && <span>${fmtMoney(dep)} upfront</span>}
                        {depositLine && completionLine && <span>·</span>}
                        {completionLine && <span>${fmtMoney(com)} upon completion</span>}
                      </div>
                    </div>
                  )
                })()}

                {/* ── Monthly Retainer card ── */}
                {recurringLine && (() => {
                  const base  = recurringLine.baseFee ?? 0
                  const tiers = base > 0 ? calcTiers(base) : null
                  const RDUR = tiers
                    ? [
                        { months: 18 as const, label: '18 Months', price: tiers.price18, savings: (base - tiers.price18) * 18, badge: 'Best Value' },
                        { months: 12 as const, label: '12 Months', price: tiers.price12, savings: (base - tiers.price12) * 12, badge: null },
                        { months: 6  as const, label: '6 Months',  price: tiers.price6,  savings: 0,                           badge: null },
                      ]
                    : []
                  const activeDuration = recurringLine.durationMonths ?? 18

                  return (
                    <div className="rounded-xl border border-[#415A77]/15 bg-white/40 overflow-hidden">
                      {/* Header */}
                      <div className="flex items-center justify-between px-4 pt-4 pb-3">
                        <span className="text-[10px] font-bold tracking-widest text-[#415A77] uppercase">Monthly Retainer</span>
                        <div className="flex items-center gap-2">
                          <GearBtn onClick={() => setShowSetup(true)} />
                          <XBtn onClick={() => removeService(recurringLine.uid)} />
                        </div>
                      </div>

                      {/* Tier rows */}
                      <div className="divide-y divide-[#415A77]/8">
                        {RDUR.map((tier, i) => {
                          const isActive    = activeDuration === tier.months
                          const rowTotal    = tier.price * tier.months
                          const hasDiscount = tier.price < base
                          const monthsFree  = base > 0 && tier.savings > 0
                            ? Math.round((tier.savings / base) * 10) / 10
                            : 0

                          return (
                            <button
                              key={tier.months}
                              type="button"
                              onClick={() => updateService(recurringLine.uid, { durationMonths: tier.months, amount: String(tier.price) })}
                              className={`w-full text-left py-3 transition-all duration-200 border-l-[3px] ${
                                isActive
                                  ? 'bg-[#415A77]/[0.07] border-[#415A77] pl-[13px] pr-4'
                                  : 'bg-transparent border-transparent px-4 hover:bg-[#415A77]/4'
                              } ${i === RDUR.length - 1 ? 'pb-4' : ''}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                {/* Left: label + savings */}
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                    <span className={`text-sm font-bold ${isActive ? 'text-[#415A77]' : 'text-[#0D1B2A]'}`}>{tier.label}</span>
                                    {tier.badge && (
                                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">{tier.badge}</span>
                                    )}
                                  </div>
                                  {monthsFree > 0 && (
                                    <p className="text-[11px] text-[#8a9bb0]">Save ${fmtMoney(tier.savings)} — that&apos;s {monthsFree} months free</p>
                                  )}
                                  {!hasDiscount && (
                                    <p className="text-[11px] text-[#8a9bb0]">No commitment discount applied</p>
                                  )}
                                </div>

                                {/* Right: pricing */}
                                <div className="shrink-0 text-right">
                                  <div className="flex items-baseline justify-end gap-1.5">
                                    {hasDiscount && (
                                      <span className="text-xs text-[#b0bac4] line-through">${fmtMoney(base)}/mo</span>
                                    )}
                                    {hasDiscount && (
                                      <svg className="h-3 w-3 text-[#b0bac4] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                      </svg>
                                    )}
                                    <span className={`text-sm font-bold ${isActive ? 'text-[#415A77]' : 'text-[#0D1B2A]'}`}>${fmtMoney(tier.price)}/mo</span>
                                  </div>
                                  <p className="text-[11px] text-[#8a9bb0] mt-0.5">${fmtMoney(rowTotal)} total</p>
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

              </div>
            )
          })()}
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
        {/* Back button — top left */}
        <div className="absolute top-5 left-6 z-10">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-white/70 hover:text-white transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </a>
        </div>

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
