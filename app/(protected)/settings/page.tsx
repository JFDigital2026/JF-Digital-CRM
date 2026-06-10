'use client'

import React from 'react'
import Link from 'next/link'
import { Settings2, Tag, Key, Webhook, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'

const SETTINGS_SECTIONS = [
  {
    href: '/settings/api',
    icon: Key,
    title: 'API Keys',
    description: 'Create and manage Bearer token API keys for programmatic access to your CRM data.',
  },
  {
    href: '/settings/webhooks',
    icon: Webhook,
    title: 'Webhooks',
    description: 'Configure outbound webhook endpoints to receive real-time notifications when events occur.',
  },
  {
    href: '/settings/custom-fields',
    icon: Settings2,
    title: 'Custom Fields',
    description: 'Add extra fields to contact profiles — things like LinkedIn URL, lead score, or any detail specific to your workflow.',
  },
  {
    href: '/settings/custom-values',
    icon: Tag,
    title: 'Custom Values',
    description: 'Manage merge tags like {{firstName}}, {{email}}, {{companyName}} for use in mass outreach and templates.',
  },
]

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-2xl">
      <PageHeader title="Settings" subtitle="Manage your CRM configuration." />

      <div className="mt-6 space-y-3">
        {SETTINGS_SECTIONS.map(({ href, icon: Icon, title, description }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm hover:border-[#415A77]/30 hover:shadow-md transition-all group"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0D1B2A]/5 text-[#415A77] group-hover:bg-[#415A77] group-hover:text-white transition-colors">
              <Icon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{title}</p>
              <p className="mt-0.5 text-xs text-gray-500">{description}</p>
            </div>
            <ChevronRight size={16} className="shrink-0 text-gray-300 group-hover:text-gray-500" />
          </Link>
        ))}
      </div>
    </div>
  )
}
