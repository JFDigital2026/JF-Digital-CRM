'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Users, Building2, TrendingUp, CheckSquare, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type SearchResult = {
  id: string
  label: string
  sub?: string
  href: string
  type: 'contact' | 'company' | 'opportunity' | 'task'
}

type RawResults = {
  contacts: { id: string; firstName: string; lastName: string; email: string | null; leadStatus: string | null }[]
  companies: { id: string; name: string; industry: string | null }[]
  opportunities: { id: string; title: string; value: number | null; stage: { name: string } | null }[]
  tasks: { id: string; title: string; status: string; priority: string }[]
}

const TYPE_META = {
  contact:     { icon: Users,       label: 'Contacts',      color: 'text-blue-500   bg-blue-50' },
  company:     { icon: Building2,   label: 'Companies',     color: 'text-indigo-500 bg-indigo-50' },
  opportunity: { icon: TrendingUp,  label: 'Opportunities', color: 'text-purple-500 bg-purple-50' },
  task:        { icon: CheckSquare, label: 'Tasks',         color: 'text-amber-500  bg-amber-50' },
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function flatten(raw: RawResults): SearchResult[] {
  const results: SearchResult[] = []
  for (const c of raw.contacts ?? []) {
    results.push({ id: c.id, type: 'contact', label: `${c.firstName} ${c.lastName}`, sub: c.email ?? c.leadStatus ?? undefined, href: `/contacts/${c.id}` })
  }
  for (const co of raw.companies ?? []) {
    results.push({ id: co.id, type: 'company', label: co.name, sub: co.industry ?? undefined, href: `/companies/${co.id}` })
  }
  for (const o of raw.opportunities ?? []) {
    results.push({ id: o.id, type: 'opportunity', label: o.title, sub: o.stage?.name ?? undefined, href: `/pipeline?opp=${o.id}` })
  }
  for (const t of raw.tasks ?? []) {
    results.push({ id: t.id, type: 'task', label: t.title, sub: t.priority, href: `/tasks` })
  }
  return results
}

interface GlobalSearchProps {
  open: boolean
  onClose: () => void
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debouncedQuery = useDebounce(query, 200)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setResults([])
      setActiveIdx(0)
    }
  }, [open])

  useEffect(() => {
    if (!debouncedQuery.trim() || debouncedQuery.length < 1) {
      setResults([])
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.json())
      .then((data: RawResults) => {
        if (!cancelled) {
          setResults(flatten(data))
          setActiveIdx(0)
        }
      })
      .catch(() => { if (!cancelled) setResults([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [debouncedQuery])

  const navigate = useCallback((result: SearchResult) => {
    router.push(result.href)
    onClose()
  }, [router, onClose])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)) }
      if (e.key === 'Enter' && results[activeIdx]) { navigate(results[activeIdx]) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, results, activeIdx, navigate, onClose])

  if (!open) return null

  // Group by type
  const grouped: Record<string, SearchResult[]> = {}
  for (const r of results) {
    if (!grouped[r.type]) grouped[r.type] = []
    grouped[r.type].push(r)
  }

  const flatForIndex = results

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh] px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-gray-100 bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
          <Search size={18} className="text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contacts, companies, deals, tasks…"
            className="flex-1 text-sm text-gray-900 outline-none placeholder:text-gray-400 bg-transparent"
          />
          <div className="flex items-center gap-2">
            {loading && (
              <div className="h-4 w-4 rounded-full border-2 border-gray-200 border-t-[#415A77] animate-spin" />
            )}
            <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-gray-200 bg-gray-50 px-1.5 font-mono text-[10px] text-gray-400">
              ESC
            </kbd>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
          {!query.trim() ? (
            <div className="py-10 text-center">
              <Search size={24} className="mx-auto text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">Type to search across your CRM</p>
              <div className="flex items-center justify-center gap-6 mt-4 text-xs text-gray-400">
                {Object.values(TYPE_META).map((m) => {
                  const Icon = m.icon
                  return (
                    <span key={m.label} className="flex items-center gap-1">
                      <Icon size={12} /> {m.label}
                    </span>
                  )
                })}
              </div>
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="py-10 text-center">
              <p className="text-sm text-gray-400">No results for &quot;{query}&quot;</p>
            </div>
          ) : (
            <div className="py-2">
              {(Object.keys(grouped) as (keyof typeof TYPE_META)[]).map((type) => {
                const meta = TYPE_META[type]
                const Icon = meta.icon
                return (
                  <div key={type} className="mb-1">
                    {/* Group header */}
                    <div className="flex items-center gap-2 px-4 py-1.5">
                      <div className={cn('h-5 w-5 rounded flex items-center justify-center shrink-0', meta.color)}>
                        <Icon size={10} />
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{meta.label}</span>
                    </div>
                    {/* Items */}
                    {grouped[type].map((result) => {
                      const globalIdx = flatForIndex.indexOf(result)
                      const active = activeIdx === globalIdx
                      return (
                        <button
                          key={result.id}
                          onMouseEnter={() => setActiveIdx(globalIdx)}
                          onClick={() => navigate(result)}
                          className={cn(
                            'flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors',
                            active ? 'bg-[#415A77]/8 text-gray-900' : 'text-gray-700 hover:bg-gray-50'
                          )}
                        >
                          <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center shrink-0', meta.color)}>
                            <Icon size={13} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{result.label}</p>
                            {result.sub && <p className="text-xs text-gray-400 truncate">{result.sub}</p>}
                          </div>
                          {active && <ArrowRight size={13} className="text-gray-400 shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        {results.length > 0 && (
          <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-50 bg-gray-50/60">
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <kbd className="inline-flex h-4 items-center rounded border border-gray-200 bg-white px-1 font-mono text-[9px]">↑↓</kbd> navigate
            </span>
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <kbd className="inline-flex h-4 items-center rounded border border-gray-200 bg-white px-1 font-mono text-[9px]">↵</kbd> open
            </span>
            <span className="text-[10px] text-gray-400 ml-auto">{results.length} result{results.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
    </div>
  )
}
