'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { NotificationBell } from '@/components/ui/notification-bell'
import { GlobalSearch } from '@/components/global-search'
import { useSession } from 'next-auth/react'

const routeTitles: Record<string, string> = {
  '/dashboard':    'Dashboard',
  '/contacts':     'Contacts',
  '/companies':    'Companies',
  '/pipelines':    'Pipelines',
  '/calendar':     'Calendar',
  '/inbox':        'Inbox',
  '/tasks':        'Tasks',
  '/products':     'Products',
  '/automations':  'Automations',
  '/metrics':      'Metrics',
  '/ai-assistant': 'AI Assistant',
  '/settings':     'Settings',
}

export function Topbar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const title =
    Object.entries(routeTitles).find(
      ([path]) => pathname === path || pathname.startsWith(path + '/')
    )?.[1] ?? 'CRM'

  const initials = session?.user?.name
    ? session.user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  return (
    <>
      <header
        className="flex shrink-0 items-center gap-4 px-6"
        style={{
          height: 60,
          background: 'rgba(255,255,255,0.65)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.50)',
        }}
      >
        <h1 className="w-40 shrink-0 truncate" style={{ fontSize: 18, fontWeight: 600, color: '#1B263B' }}>
          {title}
        </h1>

        {/* Search trigger */}
        <div className="mx-auto max-w-xl flex-1">
          <button
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center gap-2.5 text-left transition-all duration-200"
            style={{
              height: 36,
              background: 'rgba(13,27,42,0.06)',
              border: '1px solid rgba(13,27,42,0.08)',
              borderRadius: 10,
              padding: '0 14px',
              color: '#778DA9',
              fontSize: 14,
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = '#415A77'
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.80)'
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(13,27,42,0.08)'
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(13,27,42,0.06)'
            }}
          >
            <Search size={15} className="shrink-0" />
            <span className="flex-1">Search…</span>
            <kbd
              className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border px-1.5 font-mono"
              style={{ fontSize: 10, background: 'rgba(255,255,255,0.70)', borderColor: 'rgba(13,27,42,0.10)', color: '#778DA9' }}
            >
              <span>⌘</span><span>K</span>
            </kbd>
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div
            className="flex items-center justify-center rounded-[10px] transition-colors duration-150"
            style={{ width: 36, height: 36 }}
          >
            <NotificationBell />
          </div>
          <Avatar className="h-8 w-8 cursor-pointer">
            <AvatarFallback
              className="text-xs font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #415A77, #778DA9)' }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>
      </header>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
