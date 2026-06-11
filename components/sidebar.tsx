'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { signOut, useSession } from 'next-auth/react'
import {
  LayoutDashboard,
  Users,
  Building2,
  Kanban,
  Calendar,
  Inbox,
  CheckSquare,
  Package,
  Zap,
  BarChart3,
  Bot,
  Settings,
  LogOut,
  ChevronDown,
  ChevronLeft,
  ClipboardList,
} from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { usePermissions } from '@/lib/hooks/usePermissions'

const navItems = [
  { href: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard',    module: 'dashboard' },
  { href: '/contacts',     icon: Users,           label: 'Contacts',     module: 'contacts' },
  { href: '/companies',    icon: Building2,       label: 'Companies',    module: 'companies' },
  { href: '/pipeline',     icon: Kanban,          label: 'Pipeline',     module: 'pipelines' },
  { href: '/calendar',     icon: Calendar,        label: 'Calendar',     module: 'calendar' },
  { href: '/inbox',        icon: Inbox,           label: 'Inbox',        module: 'inbox' },
  { href: '/tasks',        icon: CheckSquare,     label: 'Tasks',        module: 'tasks' },
  { href: '/products',     icon: Package,         label: 'Products',     module: 'products' },
  { href: '/enrollment',   icon: ClipboardList,   label: 'Enrollment',   module: 'contacts' },
  { href: '/automations',  icon: Zap,             label: 'Automations',  module: 'automations' },
  { href: '/metrics',      icon: BarChart3,       label: 'Metrics',      module: 'metrics' },
  { href: '/ai-assistant', icon: Bot,             label: 'AI Assistant', module: 'aiAssistant' },
]

const bottomNavItems = [
  { href: '/settings', icon: Settings, label: 'Settings' },
]

function NavLink({
  href,
  icon: Icon,
  label,
  collapsed,
  onClick,
}: {
  href: string
  icon: React.ElementType
  label: string
  collapsed: boolean
  onClick?: () => void
}) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(href + '/')

  return (
    <Link href={href} title={collapsed ? label : undefined} className="relative block" onClick={onClick}>
      {isActive && (
        <motion.div
          layoutId="sidebar-active"
          className="absolute inset-0 rounded-[10px]"
          style={{ background: 'rgba(119,141,169,0.18)', border: '1px solid rgba(119,141,169,0.25)' }}
          transition={{ type: 'spring', bounce: 0.15, duration: 0.35 }}
        />
      )}
      <div
        className="relative flex items-center gap-[10px] rounded-[10px] px-3 transition-all duration-150"
        style={{
          height: 44,
          color: isActive ? '#E0E1DD' : '#778DA9',
          fontWeight: isActive ? 500 : 400,
          fontSize: 14,
        }}
        onMouseEnter={(e) => {
          if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'
          if (!isActive) (e.currentTarget as HTMLElement).style.color = 'rgba(224,225,221,0.90)'
        }}
        onMouseLeave={(e) => {
          if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'
          if (!isActive) (e.currentTarget as HTMLElement).style.color = '#778DA9'
        }}
      >
        <Icon size={18} className="shrink-0" />
        {!collapsed && <span className="truncate">{label}</span>}
      </div>
    </Link>
  )
}

interface SidebarProps {
  mobileOpen?: boolean
  onMobileClose?: () => void
}

function SidebarContent({
  collapsed,
  setCollapsed,
  onNavClick,
}: {
  collapsed: boolean
  setCollapsed: (v: boolean) => void
  onNavClick?: () => void
}) {
  const { data: session } = useSession()
  const { can } = usePermissions()

  const visibleNavItems = navItems.filter((item) => can(item.module, 'view'))

  const initials = session?.user?.name
    ? session.user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ backgroundColor: '#0D1B2A' }}>
      {/* Logo */}
      <div
        className="flex items-center gap-2.5"
        style={{
          padding: collapsed ? '20px 14px 12px' : '20px 16px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#415A77]">
          <span className="text-sm font-bold text-white">C</span>
        </div>
        {!collapsed && (
          <span className="text-lg font-semibold tracking-tight text-[#E0E1DD] truncate">CRM</span>
        )}
      </div>

      {/* Main Nav */}
      <nav className="flex-1 overflow-y-auto" style={{ padding: '12px 8px' }}>
        <div className="space-y-0.5">
          {visibleNavItems.map((item) => (
            <NavLink key={item.href} {...item} collapsed={collapsed} onClick={onNavClick} />
          ))}
        </div>
      </nav>

      {/* Bottom nav + collapse toggle */}
      <div style={{ padding: '0 8px' }}>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, paddingBottom: 8 }}>
          {bottomNavItems.map((item) => (
            <NavLink key={item.href} {...item} collapsed={collapsed} onClick={onNavClick} />
          ))}
        </div>

        {/* Collapse toggle — desktop only */}
        <div className="hidden lg:block" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 0' }}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex items-center justify-center rounded-[8px] w-full transition-colors duration-150"
            style={{ height: 36, color: '#778DA9' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <ChevronLeft
              size={16}
              style={{
                transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
                transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          </button>
        </div>
      </div>

      {/* User Footer */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px 12px' }}>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left outline-none bg-transparent border-0 cursor-pointer transition-colors duration-150"
            style={{ padding: collapsed ? '8px 4px' : undefined }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="text-xs font-semibold text-white" style={{ background: 'linear-gradient(135deg, #415A77, #778DA9)' }}>
                {initials}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-[#E0E1DD]" style={{ fontSize: 13 }}>
                    {session?.user?.name || 'User'}
                  </p>
                  <p className="truncate text-[#778DA9]" style={{ fontSize: 11 }}>
                    {session?.user?.email || ''}
                  </p>
                </div>
                <ChevronDown size={14} className="shrink-0 text-[#778DA9]" />
              </>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-48">
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="cursor-pointer text-red-600 focus:text-red-600"
            >
              <LogOut size={14} className="mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const width = collapsed ? 64 : 240

  // Close mobile drawer on route change
  const pathname = usePathname()
  useEffect(() => {
    onMobileClose?.()
  }, [pathname])

  return (
    <>
      {/* Desktop sidebar */}
      <div
        className="hidden lg:flex h-full flex-col shrink-0 overflow-hidden"
        style={{
          width,
          minWidth: width,
          transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1), min-width 0.25s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <SidebarContent collapsed={collapsed} setCollapsed={setCollapsed} />
      </div>

      {/* Mobile drawer overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 lg:hidden"
              style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
              onClick={onMobileClose}
            />
            {/* Drawer */}
            <motion.div
              key="drawer"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed left-0 top-0 bottom-0 z-50 lg:hidden"
              style={{ width: 260 }}
            >
              <SidebarContent
                collapsed={false}
                setCollapsed={() => {}}
                onNavClick={onMobileClose}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
