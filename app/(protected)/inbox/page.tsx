'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { format } from 'date-fns'
import {
  Mail, MessageSquare, Globe, Users, Network,
  Search, Send, Sparkles, X, Trash2, Star,
  SlidersHorizontal, ArrowUpDown, Inbox as InboxIcon,
  ClipboardList, Phone, PanelRightClose, PanelRightOpen,
  ExternalLink, User, GitBranch, SquarePen, Maximize2, Minimize2,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

type InboxTab = 'unread' | 'all' | 'recents' | 'starred'
type ContactDetailTab = 'fields' | 'dnd' | 'actions'
type ComposeRecipient =
  | { type: 'contact'; id: string; name: string; email?: string | null; phone?: string | null }
  | { type: 'direct'; address: string }
type MessageChannel = 'EMAIL' | 'SMS' | 'INSTAGRAM' | 'FACEBOOK' | 'LINKEDIN'
type MessageDirection = 'INBOUND' | 'OUTBOUND'

type ConversationRow = {
  contact: {
    id: string
    firstName: string
    lastName: string
    email?: string | null
    phone?: string | null
    leadStatus: string
    avatarUrl?: string | null
    company?: { id: string; name: string } | null
  }
  latestMessage: {
    id: string
    body: string
    channel: MessageChannel
    direction: MessageDirection
    subject?: string | null
    createdAt: string
  }
  unreadCount: number
  channels: MessageChannel[]
}

type Message = {
  id: string
  contactId: string
  direction: MessageDirection
  channel: MessageChannel
  subject?: string | null
  body: string
  read: boolean
  createdAt: string
}

type ConversationNote = {
  id: string
  contactId: string
  body: string
  userId: string
  user: { id: string; name: string | null }
  createdAt: string
}

type ContactDetail = {
  id: string
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  leadStatus: string
  avatarUrl?: string | null
  title?: string | null
  source?: string | null
  tags: string[]
  doNotContact: boolean
  notes?: string | null
  company?: { id: string; name: string } | null
}

// ── Channel Icon ─────────────────────────────────────────────────────────────

function ChannelIcon({ channel, size = 14 }: { channel: string; size?: number }) {
  switch (channel) {
    case 'EMAIL':     return <Mail size={size} className="text-blue-500" />
    case 'SMS':       return <MessageSquare size={size} className="text-green-500" />
    case 'INSTAGRAM': return <Globe size={size} className="text-pink-500" />
    case 'FACEBOOK':  return <Users size={size} className="text-blue-600" />
    case 'LINKEDIN':  return <Network size={size} className="text-blue-700" />
    default:          return null
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function formatRelative(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  if (hours < 24) return `${hours}h`
  if (days < 7) return `${days}d`
  return format(date, 'MMM d')
}

function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return format(date, 'MMMM d, yyyy')
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n) + '…' : str
}

function getContactDisplayName(contact: { firstName: string; lastName: string; phone?: string | null; email?: string | null }): string {
  const full = `${contact.firstName} ${contact.lastName}`.trim()
  if (full && full !== ' ') return full
  return contact.phone ?? contact.email ?? 'Unknown'
}

// ── Page Component ────────────────────────────────────────────────────────────

export default function InboxPage() {

  // ── Tab ────────────────────────────────────────────────────────────────────
  const [inboxTab, setInboxTab] = useState<InboxTab>('all')

  // ── Starred (localStorage-backed) ──────────────────────────────────────────
  const [starredIds, setStarredIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set<string>()
    try {
      const s = localStorage.getItem('crm-starred-contacts')
      if (!s) return new Set<string>()
      const arr = JSON.parse(s) as string[]
      const set = new Set<string>()
      arr.forEach(id => set.add(id))
      return set
    } catch { return new Set<string>() }
  })

  function toggleStar(contactId: string, e: React.MouseEvent) {
    e.stopPropagation()
    setStarredIds(prev => {
      const next = new Set<string>()
      prev.forEach(id => next.add(id))
      if (next.has(contactId)) next.delete(contactId)
      else next.add(contactId)
      const arr: string[] = []
      next.forEach(id => arr.push(id))
      try { localStorage.setItem('crm-starred-contacts', JSON.stringify(arr)) } catch {}
      return next
    })
  }

  // ── Left panel ─────────────────────────────────────────────────────────────
  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)

  // ── Center panel ───────────────────────────────────────────────────────────
  const [selectedContact, setSelectedContact] = useState<ContactDetail | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [replySubject, setReplySubject] = useState('')
  const [replyChannel, setReplyChannel] = useState<'EMAIL' | 'SMS'>('SMS')
  const [sending, setSending] = useState(false)
  const [showAIPanel, setShowAIPanel] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // ── Notes modal ────────────────────────────────────────────────────────────
  const [showNotesModal, setShowNotesModal] = useState(false)
  const [notes, setNotes] = useState<ConversationNote[]>([])
  const [noteInput, setNoteInput] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  // ── Right panel ────────────────────────────────────────────────────────────
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [contactDetailTab, setContactDetailTab] = useState<ContactDetailTab>('fields')
  const [editingContact, setEditingContact] = useState<Partial<ContactDetail>>({})
  const [savingContact, setSavingContact] = useState(false)
  const [tagInput, setTagInput] = useState('')

  // ── Save as Contact modal ──────────────────────────────────────────────────
  const [showSaveContactModal, setShowSaveContactModal] = useState(false)
  const [saveContactFirstName, setSaveContactFirstName] = useState('')
  const [saveContactLastName, setSaveContactLastName] = useState('')
  const [saveContactEmail, setSaveContactEmail] = useState('')
  const [saveContactPhone, setSaveContactPhone] = useState('')
  const [savingAsContact, setSavingAsContact] = useState(false)

  // ── Compose modal ──────────────────────────────────────────────────────────
  const [showComposeModal, setShowComposeModal] = useState(false)
  const [composeFullscreen, setComposeFullscreen] = useState(false)
  const [composeRecipient, setComposeRecipient] = useState<ComposeRecipient | null>(null)
  const [composeContactSearch, setComposeContactSearch] = useState('')
  const [composeContactResults, setComposeContactResults] = useState<{ id: string; firstName: string; lastName: string; email?: string | null; phone?: string | null }[]>([])
  const [composeChannel, setComposeChannel] = useState<'SMS' | 'EMAIL'>('SMS')
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [composeSending, setComposeSending] = useState(false)
  const [composeSearchOpen, setComposeSearchOpen] = useState(false)

  // ── Toast ──────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Tab filtering ──────────────────────────────────────────────────────────

  const filteredConversations = useMemo(() => {
    let list = conversations
    const now = new Date()
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    switch (inboxTab) {
      case 'unread':  list = list.filter(c => c.unreadCount > 0); break
      case 'recents': list = list.filter(c => new Date(c.latestMessage.createdAt) >= dayAgo); break
      case 'starred': list = list.filter(c => starredIds.has(c.contact.id)); break
    }
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(c => {
        const name = `${c.contact.firstName} ${c.contact.lastName}`.toLowerCase()
        const preview = c.latestMessage.body.toLowerCase()
        return name.includes(q) || preview.includes(q)
      })
    }
    return list
  }, [conversations, inboxTab, starredIds, search])

  const unreadCount = useMemo(() => conversations.filter(c => c.unreadCount > 0).length, [conversations])

  // ── Grouped messages ───────────────────────────────────────────────────────

  const groupedMessages = useMemo(() => {
    if (!messages.length) return []
    const groups: { dateStr: string; messages: Message[] }[] = []
    let currentDate = ''
    messages.forEach(msg => {
      const dateKey = new Date(msg.createdAt).toDateString()
      if (dateKey !== currentDate) {
        currentDate = dateKey
        groups.push({ dateStr: msg.createdAt, messages: [] })
      }
      groups[groups.length - 1].messages.push(msg)
    })
    return groups
  }, [messages])

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchConversations = useCallback(async () => {
    setLoadingConvs(true)
    const res = await fetch('/api/messages')
    const data = res.ok ? await res.json() : {}
    setConversations(data.conversations ?? [])
    setLoadingConvs(false)
  }, [])

  useEffect(() => { fetchConversations() }, [fetchConversations])

  const fetchMessages = useCallback(async (contactId: string) => {
    setLoadingMsgs(true)
    const res = await fetch(`/api/messages/${contactId}`)
    const data = res.ok ? await res.json() : {}
    setMessages(data.messages ?? [])
    setSelectedContact(data.contact ?? null)
    // Mark all read
    fetch(`/api/messages/${contactId}/read-all`, { method: 'PATCH' })
    // Update unread count in list
    setConversations(prev =>
      prev.map(c => c.contact.id === contactId ? { ...c, unreadCount: 0 } : c)
    )
    setLoadingMsgs(false)
  }, [])

  useEffect(() => {
    if (selectedContactId) fetchMessages(selectedContactId)
  }, [selectedContactId, fetchMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchNotes = useCallback(async (contactId: string) => {
    const res = await fetch(`/api/conversation-notes?contactId=${contactId}`)
    const data = res.ok ? await res.json() : {}
    setNotes(data.notes ?? [])
  }, [])

  useEffect(() => {
    if (selectedContactId) fetchNotes(selectedContactId)
  }, [selectedContactId, fetchNotes])

  // ── Sync editingContact when contact loads ─────────────────────────────────

  useEffect(() => {
    if (selectedContact) {
      setEditingContact({
        firstName: selectedContact.firstName,
        lastName: selectedContact.lastName,
        email: selectedContact.email ?? '',
        phone: selectedContact.phone ?? '',
        title: selectedContact.title ?? '',
        source: selectedContact.source ?? '',
        leadStatus: selectedContact.leadStatus,
        tags: selectedContact.tags ?? [],
      })
    }
  }, [selectedContact])

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSelectContact = (contactId: string) => {
    setSelectedContactId(contactId)
    setReplyBody('')
    setReplySubject('')
    setShowAIPanel(false)
    setAiSuggestion('')
    setContactDetailTab('fields')
  }

  const handleSend = async () => {
    if (!selectedContactId || !replyBody.trim() || sending) return
    setSending(true)
    const res = await fetch('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactId: selectedContactId,
        channel: replyChannel,
        body: replyBody,
        subject: replySubject || undefined,
      }),
    })
    if (res.ok) {
      const msg = await res.json()
      setMessages(prev => [...prev, msg])
      setReplyBody('')
      setReplySubject('')
      fetchConversations()
    } else {
      showToast('Failed to send message', 'error')
    }
    setSending(false)
  }

  const handleAIReply = async () => {
    if (!selectedContactId) return
    setShowAIPanel(true)
    setAiLoading(true)
    setAiSuggestion('')
    const res = await fetch('/api/messages/ai-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId: selectedContactId, channel: replyChannel }),
    })
    const data = res.ok ? await res.json() : {}
    setAiSuggestion(data.suggestion ?? '')
    setAiLoading(false)
  }

  const handleSaveNote = async () => {
    if (!selectedContactId || !noteInput.trim() || savingNote) return
    setSavingNote(true)
    const res = await fetch('/api/conversation-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId: selectedContactId, body: noteInput }),
    })
    if (res.ok) {
      const note = await res.json()
      setNotes(prev => [note, ...prev])
      setNoteInput('')
    }
    setSavingNote(false)
  }

  const handleDeleteNote = async (id: string) => {
    await fetch(`/api/conversation-notes/${id}`, { method: 'DELETE' })
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  const handleSaveContact = useCallback(async () => {
    if (!selectedContactId || savingContact) return
    setSavingContact(true)
    const res = await fetch(`/api/contacts/${selectedContactId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingContact),
    })
    if (res.ok) {
      setSelectedContact(prev => prev ? { ...prev, ...editingContact } : prev)
      showToast('Contact saved')
    } else {
      showToast('Failed to save', 'error')
    }
    setSavingContact(false)
  }, [selectedContactId, savingContact, editingContact])

  const handleToggleDND = async () => {
    if (!selectedContactId) return
    const newVal = !selectedContact?.doNotContact
    await fetch(`/api/contacts/${selectedContactId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doNotContact: newVal }),
    })
    setSelectedContact(prev => prev ? { ...prev, doNotContact: newVal } : prev)
  }

  const handlePromoteContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedContactId || savingAsContact) return
    setSavingAsContact(true)
    const res = await fetch(`/api/contacts/${selectedContactId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: saveContactFirstName,
        lastName: saveContactLastName,
        email: saveContactEmail || undefined,
        phone: saveContactPhone || undefined,
        tags: (selectedContact?.tags ?? []).filter((t: string) => t !== '__unverified__'),
      }),
    })
    setSavingAsContact(false)
    if (res.ok) {
      const updated = await res.json()
      setSelectedContact((prev: any) => prev ? { ...prev, ...updated } : prev)
      setConversations(prev => prev.map(c =>
        c.contact.id === selectedContactId
          ? { ...c, contact: { ...c.contact, firstName: saveContactFirstName, lastName: saveContactLastName } }
          : c
      ))
      setShowSaveContactModal(false)
      showToast('Contact saved')
    } else {
      showToast('Failed to save contact', 'error')
    }
  }

  // ── Compose: contact search ────────────────────────────────────────────────

  const searchContacts = useCallback(async (q: string) => {
    if (!q.trim()) { setComposeContactResults([]); return }
    const res = await fetch(`/api/contacts?search=${encodeURIComponent(q)}&pageSize=8`)
    const data = res.ok ? await res.json() : {}
    setComposeContactResults(data.contacts ?? [])
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => searchContacts(composeContactSearch), 300)
    return () => clearTimeout(timer)
  }, [composeContactSearch, searchContacts])

  // ── Escape key: close fullscreen compose ──────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setComposeFullscreen(false)
    }
    if (composeFullscreen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [composeFullscreen])

  // ── Compose: send handler ──────────────────────────────────────────────────

  const handleComposeSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!composeRecipient || !composeBody.trim() || composeSending) return
    setComposeSending(true)
    const payload = composeRecipient.type === 'contact'
      ? { contactId: composeRecipient.id, channel: composeChannel, body: composeBody, subject: composeSubject || undefined }
      : { toAddress: composeRecipient.address, addressType: composeChannel === 'SMS' ? 'phone' : 'email', channel: composeChannel, body: composeBody, subject: composeSubject || undefined }
    const res = await fetch('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setComposeSending(false)
    if (res.ok) {
      const data = res.ok ? await res.json() : {}
      setShowComposeModal(false)
      setComposeFullscreen(false)
      setComposeRecipient(null)
      setComposeContactSearch('')
      setComposeBody('')
      setComposeSubject('')
      setComposeChannel('SMS')
      fetchConversations()
      showToast('Message sent')
      const sentContactId = data?.contact?.id ?? data?.contactId
      if (sentContactId) {
        if (sentContactId === selectedContactId) {
          fetchMessages(sentContactId)
        } else {
          handleSelectContact(sentContactId)
        }
      }
    } else {
      showToast('Failed to send', 'error')
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex overflow-hidden bg-white rounded-xl border border-gray-200" style={{ height: 'calc(100vh - 108px)' }}>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-lg ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* ══ LEFT PANEL ══════════════════════════════════════════════ */}
      <div className="w-[280px] shrink-0 flex flex-col border-r border-gray-200 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900 text-sm">Team Inbox</h2>
          <div className="flex items-center gap-1.5">
            <button className="text-gray-400 hover:text-gray-600 p-1"><SlidersHorizontal size={14} /></button>
            <button className="text-gray-400 hover:text-gray-600 p-1"><ArrowUpDown size={14} /></button>
            <button onClick={() => setShowComposeModal(true)} title="New Message"
              className="text-gray-400 hover:text-[#0D1B2A] p-1 transition-colors">
              <SquarePen size={14} />
            </button>
          </div>
        </div>

        {/* Tabs: Unread | All | Recents | Starred */}
        <div className="flex border-b border-gray-200">
          {([
            { id: 'unread', label: 'Unread', count: unreadCount },
            { id: 'all', label: 'All' },
            { id: 'recents', label: 'Recents' },
            { id: 'starred', label: 'Starred' },
          ] as { id: InboxTab; label: string; count?: number }[]).map(tab => (
            <button key={tab.id} onClick={() => setInboxTab(tab.id)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors relative
                ${inboxTab === tab.id ? 'text-[#0D1B2A] border-b-2 border-[#0D1B2A] -mb-px' : 'text-gray-500 hover:text-gray-700'}`}>
              {tab.label}
              {tab.count ? (
                <span className="ml-1 bg-blue-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">{tab.count}</span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-gray-100">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search conversations…"
              className="w-full rounded-md border border-gray-200 pl-7 pr-3 py-1.5 text-xs text-gray-900 outline-none focus:border-[#415A77]" />
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            <div className="flex items-center justify-center h-20 text-xs text-gray-400">Loading…</div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-gray-400">
              <InboxIcon size={24} className="text-gray-300" />
              <span className="text-xs">No conversations</span>
            </div>
          ) : filteredConversations.map(conv => {
            const isSelected = selectedContactId === conv.contact.id
            const hasUnread = conv.unreadCount > 0
            const isStarred = starredIds.has(conv.contact.id)
            return (
              <button key={conv.contact.id} onClick={() => handleSelectContact(conv.contact.id)}
                className={`w-full flex items-start gap-3 px-3 py-3 text-left transition-colors border-b border-gray-100 last:border-0 group
                  ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}
                  ${hasUnread && !isSelected ? 'border-l-2 border-l-blue-500' : 'border-l-2 border-l-transparent'}`}>
                {/* Avatar with channel badge */}
                <div className="relative shrink-0">
                  <div className="h-9 w-9 rounded-full bg-[#415A77] flex items-center justify-center text-xs font-bold text-white">
                    {getInitials(conv.contact.firstName, conv.contact.lastName)}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5">
                    <ChannelIcon channel={conv.latestMessage.channel} size={11} />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-xs truncate ${hasUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                      {getContactDisplayName(conv.contact)}
                    </span>
                    <span className="text-[10px] text-gray-400 shrink-0">{formatRelative(conv.latestMessage.createdAt)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5 gap-1">
                    <span className="text-[11px] text-gray-500 truncate">{truncate(conv.latestMessage.body, 55)}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {conv.unreadCount > 0 && (
                        <span className="bg-blue-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                          {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                        </span>
                      )}
                      <button onClick={e => toggleStar(conv.contact.id, e)}
                        className={`p-0.5 transition-colors ${isStarred ? 'text-amber-400' : 'text-gray-300 group-hover:text-gray-400'}`}>
                        <Star size={12} fill={isStarred ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ══ CENTER PANEL ════════════════════════════════════════════ */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {!selectedContactId ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
            <InboxIcon size={40} className="text-gray-200" />
            <p className="text-sm font-medium text-gray-500">Select a conversation</p>
          </div>
        ) : (
          <>
            {/* Center header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 shrink-0 bg-white">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="h-9 w-9 rounded-full bg-[#415A77] flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {selectedContact ? getInitials(selectedContact.firstName, selectedContact.lastName) : '?'}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">
                    {selectedContact ? getContactDisplayName({
                      firstName: selectedContact.firstName,
                      lastName: selectedContact.lastName,
                      phone: selectedContact.phone ?? undefined,
                      email: selectedContact.email ?? undefined,
                    }) : ''}
                  </p>
                  {selectedContact?.company && (
                    <p className="text-xs text-gray-500 truncate">{selectedContact.company.name}</p>
                  )}
                </div>
              </div>

              {/* Action icons */}
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setShowNotesModal(true)} title="Notes"
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                  <ClipboardList size={16} />
                </button>
                {selectedContact?.phone && (
                  <a href={`tel:${selectedContact.phone}`} title="Call"
                    className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                    <Phone size={16} />
                  </a>
                )}
                <button onClick={e => selectedContactId ? toggleStar(selectedContactId, e) : undefined} title="Star"
                  className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${starredIds.has(selectedContactId ?? '') ? 'text-amber-400' : 'text-gray-400 hover:text-gray-600'}`}>
                  <Star size={16} fill={starredIds.has(selectedContactId ?? '') ? 'currentColor' : 'none'} />
                </button>
                {selectedContact?.email && (
                  <button onClick={() => setReplyChannel('EMAIL')} title="Email"
                    className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                    <Mail size={16} />
                  </button>
                )}
                {!rightCollapsed ? (
                  <button onClick={() => setRightCollapsed(true)} title="Hide details"
                    className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                    <PanelRightClose size={16} />
                  </button>
                ) : (
                  <button onClick={() => setRightCollapsed(false)} title="Show details"
                    className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                    <PanelRightOpen size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Unverified contact banner */}
            {selectedContact?.tags?.includes('__unverified__') && (
              <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 border-b border-amber-200 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">Unknown</span>
                  <span className="text-xs text-amber-700">Not in your contacts yet.</span>
                </div>
                <button
                  onClick={() => {
                    setSaveContactFirstName(selectedContact.firstName ?? '')
                    setSaveContactLastName(selectedContact.lastName ?? '')
                    setSaveContactEmail(selectedContact.email ?? '')
                    setSaveContactPhone(selectedContact.phone ?? '')
                    setShowSaveContactModal(true)
                  }}
                  className="flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-200 hover:bg-amber-300 rounded px-2 py-1 transition-colors">
                  <User size={11} />
                  Save as Contact
                </button>
              </div>
            )}

            {/* Message thread */}
            <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0 bg-gray-50">
              {loadingMsgs ? (
                <div className="flex items-center justify-center h-20 text-xs text-gray-400">Loading…</div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-20 text-xs text-gray-400">No messages yet</div>
              ) : (
                groupedMessages.map(group => (
                  <div key={group.dateStr}>
                    {/* Date separator */}
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-[11px] text-gray-400 font-medium px-2 bg-gray-50 rounded-full border border-gray-200">
                        {formatDateSeparator(group.dateStr)}
                      </span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                    {group.messages.map(msg => (
                      <div key={msg.id} className={`flex gap-2 mb-3 ${msg.direction === 'OUTBOUND' ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5
                          ${msg.direction === 'INBOUND' ? 'bg-gray-300 text-gray-700' : 'bg-[#415A77] text-white'}`}>
                          {msg.direction === 'INBOUND'
                            ? getInitials(selectedContact?.firstName ?? 'U', selectedContact?.lastName ?? 'U')
                            : 'Me'}
                        </div>
                        <div className={`flex flex-col gap-0.5 max-w-[70%] ${msg.direction === 'OUTBOUND' ? 'items-end' : 'items-start'}`}>
                          {msg.subject && <p className="text-[10px] text-gray-400 px-1">Subject: {msg.subject}</p>}
                          <div className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed
                            ${msg.direction === 'OUTBOUND'
                              ? 'bg-[#0D1B2A] text-white rounded-tr-sm'
                              : 'bg-white text-gray-900 border border-gray-200 rounded-tl-sm shadow-sm'}`}>
                            {msg.body}
                          </div>
                          <div className={`flex items-center gap-1.5 px-1 ${msg.direction === 'OUTBOUND' ? 'flex-row-reverse' : 'flex-row'}`}>
                            <span className="text-[10px] text-gray-400">{format(new Date(msg.createdAt), 'h:mm a')}</span>
                            <ChannelIcon channel={msg.channel} size={10} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply box */}
            <div className="border-t border-gray-200 bg-white px-4 py-3 shrink-0">
              {/* AI panel */}
              {showAIPanel && (
                <div className="mb-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={12} className="text-indigo-500" />
                      <span className="text-xs font-semibold text-indigo-700">AI Suggested Reply</span>
                    </div>
                    <button onClick={() => setShowAIPanel(false)} className="text-gray-400 hover:text-gray-600"><X size={12} /></button>
                  </div>
                  {aiLoading ? (
                    <p className="text-xs text-indigo-400 py-1">Generating…</p>
                  ) : (
                    <p className="text-sm text-gray-700">{aiSuggestion || 'No suggestion.'}</p>
                  )}
                  {!aiLoading && (
                    <div className="flex gap-2 mt-2">
                      <button onClick={handleAIReply} className="rounded border border-indigo-200 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-100">Regenerate</button>
                      <button onClick={() => { setReplyBody(aiSuggestion); setShowAIPanel(false) }}
                        className="rounded bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700">Use This Reply</button>
                    </div>
                  )}
                </div>
              )}

              {replyChannel === 'EMAIL' && (
                <input value={replySubject} onChange={e => setReplySubject(e.target.value)}
                  placeholder="Subject (optional)"
                  className="mb-2 w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-[#415A77]" />
              )}

              {replyChannel === 'EMAIL' && !selectedContact?.email && (
                <p className="mb-2 text-xs text-red-500">This contact has no email address — add one on their profile first.</p>
              )}
              {replyChannel === 'SMS' && !selectedContact?.phone && (
                <p className="mb-2 text-xs text-red-500">This contact has no phone number — add one on their profile first.</p>
              )}

              <div className="flex items-end gap-2">
                {/* Channel selector */}
                <select value={replyChannel} onChange={e => setReplyChannel(e.target.value as 'EMAIL' | 'SMS')}
                  className="rounded-md border border-gray-200 px-2 py-2 text-xs text-gray-700 outline-none focus:border-[#415A77] shrink-0">
                  <option value="SMS">SMS</option>
                  <option value="EMAIL">Email</option>
                </select>

                {/* Textarea */}
                <textarea value={replyBody} onChange={e => setReplyBody(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend() }}
                  rows={2} placeholder="Type a message…"
                  className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#415A77] focus:ring-1 focus:ring-[#415A77]/20" />

                {/* AI + Send */}
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button onClick={handleAIReply} title="AI Reply"
                    className="flex items-center justify-center rounded-lg border border-indigo-200 p-2 text-indigo-500 hover:bg-indigo-50">
                    <Sparkles size={14} />
                  </button>
                  <button onClick={handleSend}
                    disabled={sending || !replyBody.trim() || (replyChannel === 'EMAIL' && !selectedContact?.email) || (replyChannel === 'SMS' && !selectedContact?.phone)}
                    className="flex items-center justify-center rounded-lg bg-[#0D1B2A] p-2 text-white hover:bg-[#1B263B] disabled:opacity-40">
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ══ RIGHT PANEL (Contact Details) ═══════════════════════════ */}
      {!rightCollapsed && selectedContactId && selectedContact && (
        <div className="w-[320px] shrink-0 flex flex-col border-l border-gray-200 bg-white overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
            <h3 className="text-sm font-semibold text-gray-900">Contact Details</h3>
            <button onClick={() => setRightCollapsed(true)} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>

          {/* Contact identity card */}
          <div className="px-4 py-3 border-b border-gray-200 shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#415A77] flex items-center justify-center text-sm font-bold text-white shrink-0">
                {getInitials(selectedContact.firstName, selectedContact.lastName)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">
                  {`${selectedContact.firstName} ${selectedContact.lastName}`.trim() || selectedContact.phone || 'Unknown'}
                </p>
                {selectedContact.phone && <p className="text-xs text-gray-500">{selectedContact.phone}</p>}
              </div>
              <a href={`/contacts/${selectedContact.id}`} target="_blank" rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-600 shrink-0">
                <ExternalLink size={14} />
              </a>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 shrink-0">
            {(['fields', 'dnd', 'actions'] as ContactDetailTab[]).map(tab => (
              <button key={tab} onClick={() => setContactDetailTab(tab)}
                className={`flex-1 py-2 text-xs font-medium capitalize transition-colors
                  ${contactDetailTab === tab ? 'text-[#0D1B2A] border-b-2 border-[#0D1B2A] -mb-px' : 'text-gray-500 hover:text-gray-700'}`}>
                {tab === 'fields' ? 'All Fields' : tab === 'dnd' ? 'DND' : 'Actions'}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">

            {/* ALL FIELDS tab */}
            {contactDetailTab === 'fields' && (
              <div className="p-4 space-y-3">
                {([
                  { label: 'First Name', field: 'firstName' as const },
                  { label: 'Last Name',  field: 'lastName'  as const },
                  { label: 'Email',      field: 'email'     as const },
                  { label: 'Phone',      field: 'phone'     as const },
                  { label: 'Title',      field: 'title'     as const },
                  { label: 'Source',     field: 'source'    as const },
                ] as { label: string; field: keyof Pick<ContactDetail, 'firstName' | 'lastName' | 'email' | 'phone' | 'title' | 'source'> }[]).map(({ label, field }) => (
                  <div key={field}>
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</label>
                    <input
                      value={(editingContact[field] as string) ?? ''}
                      onChange={e => setEditingContact(prev => ({ ...prev, [field]: e.target.value }))}
                      onBlur={handleSaveContact}
                      placeholder="—"
                      className="mt-0.5 w-full rounded border border-transparent px-2 py-1.5 text-sm text-gray-900 outline-none hover:border-gray-200 focus:border-[#415A77] focus:ring-1 focus:ring-[#415A77]/20 transition-colors bg-transparent focus:bg-white"
                    />
                  </div>
                ))}

                {/* Lead Status */}
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Contact Type</label>
                  <select
                    value={editingContact.leadStatus ?? selectedContact.leadStatus}
                    onChange={e => {
                      setEditingContact(prev => ({ ...prev, leadStatus: e.target.value }))
                      setTimeout(handleSaveContact, 0)
                    }}
                    className="mt-0.5 w-full rounded border border-gray-200 px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-[#415A77] bg-white">
                    <option value="NEW">New / Lead</option>
                    <option value="TRIAL">Trial</option>
                    <option value="ACTIVE">Active / Customer</option>
                    <option value="CLOSED">Closed</option>
                    <option value="LOST">Lost</option>
                    <option value="CANNOT_CONTACT">Cannot Contact</option>
                  </select>
                </div>

                {/* Tags */}
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Tags</label>
                  <div className="mt-1 flex flex-wrap gap-1 mb-1">
                    {(editingContact.tags ?? selectedContact.tags ?? []).map(tag => (
                      <span key={tag} className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                        {tag}
                        <button onClick={() => {
                          const newTags = (editingContact.tags ?? []).filter(t => t !== tag)
                          setEditingContact(prev => ({ ...prev, tags: newTags }))
                          setTimeout(handleSaveContact, 0)
                        }} className="text-gray-400 hover:text-red-500">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && tagInput.trim()) {
                          const newTags = [...(editingContact.tags ?? []), tagInput.trim()]
                          setEditingContact(prev => ({ ...prev, tags: newTags }))
                          setTagInput('')
                          setTimeout(handleSaveContact, 0)
                        }
                      }}
                      placeholder="Add tag…"
                      className="flex-1 rounded border border-gray-200 px-2 py-1 text-xs outline-none focus:border-[#415A77]" />
                  </div>
                </div>
              </div>
            )}

            {/* DND tab */}
            {contactDetailTab === 'dnd' && (
              <div className="p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Do Not Contact</p>
                    <p className="text-xs text-gray-500 mt-0.5">Prevent all outbound messages to this contact</p>
                  </div>
                  <button onClick={handleToggleDND}
                    role="switch" aria-checked={selectedContact.doNotContact}
                    className={`relative inline-flex h-5 w-9 rounded-full transition-colors shrink-0 mt-0.5
                      ${selectedContact.doNotContact ? 'bg-red-500' : 'bg-gray-200'}`}>
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5
                      ${selectedContact.doNotContact ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                {selectedContact.doNotContact && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
                    This contact is marked Do Not Contact. Messages will not be sent.
                  </div>
                )}
              </div>
            )}

            {/* ACTIONS tab */}
            {contactDetailTab === 'actions' && (
              <div className="p-4 space-y-2">
                <a href={`/contacts/${selectedContact.id}`}
                  className="flex items-center gap-2 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  <User size={14} className="text-gray-400" />
                  View Full Profile
                </a>
                <a href="/pipeline"
                  className="flex items-center gap-2 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  <GitBranch size={14} className="text-gray-400" />
                  View in Pipeline
                </a>
                <button onClick={() => setShowNotesModal(true)}
                  className="flex items-center gap-2 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  <ClipboardList size={14} className="text-gray-400" />
                  View Notes ({notes.length})
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ NOTES MODAL ═════════════════════════════════════════════ */}
      {showNotesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-[480px] max-h-[600px] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Conversation Notes</h3>
              <button onClick={() => setShowNotesModal(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {notes.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No notes yet.</p>
              ) : notes.map(note => (
                <div key={note.id} className="rounded-xl bg-gray-50 border border-gray-200 p-3 group">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.body}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-400">{note.user.name} · {formatRelative(note.createdAt)}</span>
                    <button onClick={() => handleDeleteNote(note.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-200 p-4">
              <textarea value={noteInput} onChange={e => setNoteInput(e.target.value)} rows={3}
                placeholder="Add a private note…"
                className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#415A77]" />
              <button onClick={handleSaveNote} disabled={savingNote || !noteInput.trim()}
                className="mt-2 w-full rounded-lg bg-[#0D1B2A] py-2 text-sm font-medium text-white hover:bg-[#1B263B] disabled:opacity-40">
                {savingNote ? 'Saving…' : 'Save Note'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ COMPOSE MODAL ═══════════════════════════════════════════ */}
      {showComposeModal && (() => {
        const closeCompose = () => {
          setShowComposeModal(false)
          setComposeFullscreen(false)
          setComposeRecipient(null)
          setComposeContactSearch('')
          setComposeContactResults([])
        }

        // ── Shared recipient search block ──────────────────────────
        const RecipientField = (
          <div>
            <label className="text-xs font-semibold text-[#778DA9] uppercase tracking-wide mb-1 block">To</label>
            {composeRecipient ? (
              <div className="flex items-center gap-2 rounded-lg border border-[#415A77] bg-[#415A77]/10 px-3 py-2">
                <span className="text-sm font-medium text-gray-900 flex-1">
                  {composeRecipient.type === 'contact' ? composeRecipient.name : composeRecipient.address}
                </span>
                {composeRecipient.type === 'direct' && (
                  <span className="text-[10px] font-semibold text-[#415A77] bg-[#415A77]/20 px-1.5 py-0.5 rounded">New</span>
                )}
                <button type="button" onClick={() => { setComposeRecipient(null); setComposeContactSearch('') }}
                  className="text-gray-400 hover:text-red-500"><X size={13} /></button>
              </div>
            ) : (
              <div className="relative">
                <input
                  autoFocus
                  value={composeContactSearch}
                  onChange={e => { setComposeContactSearch(e.target.value); setComposeSearchOpen(true) }}
                  onFocus={() => setComposeSearchOpen(true)}
                  placeholder="Search contacts, or type a phone number / email…"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#415A77] focus:ring-1 focus:ring-[#415A77]/20"
                />
                {composeSearchOpen && (composeContactResults.length > 0 || composeContactSearch.trim().length > 2) && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden max-h-56 overflow-y-auto">
                    {composeContactResults.map(c => (
                      <button type="button" key={c.id}
                        onClick={() => {
                          setComposeRecipient({ type: 'contact', id: c.id, name: `${c.firstName} ${c.lastName}`.trim() || c.phone || c.email || 'Unknown', email: c.email, phone: c.phone })
                          setComposeContactSearch('')
                          setComposeContactResults([])
                          setComposeSearchOpen(false)
                          if (c.phone) setComposeChannel('SMS')
                          else if (c.email) setComposeChannel('EMAIL')
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0">
                        <div className="h-7 w-7 rounded-full bg-[#415A77] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                          {(c.firstName[0] ?? '') + (c.lastName[0] ?? '')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{c.firstName} {c.lastName}</p>
                          <p className="text-xs text-gray-500 truncate">{c.phone ?? c.email ?? ''}</p>
                        </div>
                      </button>
                    ))}
                    {composeContactSearch.trim().length > 2 && (
                      <button type="button"
                        onClick={() => {
                          const addr = composeContactSearch.trim()
                          setComposeRecipient({ type: 'direct', address: addr })
                          setComposeSearchOpen(false)
                          setComposeContactSearch('')
                          setComposeContactResults([])
                          if (addr.includes('@')) setComposeChannel('EMAIL')
                          else setComposeChannel('SMS')
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-indigo-50 border-t border-gray-100 bg-gray-50">
                        <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                          <Send size={12} className="text-indigo-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">Send to &ldquo;{composeContactSearch.trim()}&rdquo;</p>
                          <p className="text-xs text-gray-500">Not in your contacts</p>
                        </div>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )

        // ── Fullscreen layout ──────────────────────────────────────
        if (composeFullscreen) {
          if (composeChannel === 'SMS') {
            return (
              <div className="fixed inset-0 z-50 flex flex-col bg-[#0D1B2A]">
                {/* SMS fullscreen header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 shrink-0">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <MessageSquare size={16} className="text-[#778DA9] shrink-0" />
                    <span className="text-sm font-semibold text-white">New SMS</span>
                    {composeRecipient && (
                      <span className="text-sm text-[#778DA9] truncate">
                        — {composeRecipient.type === 'contact' ? composeRecipient.name : composeRecipient.address}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setComposeFullscreen(false)} title="Minimize (Esc)"
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-[#778DA9] hover:text-white hover:border-white/30 transition-colors">
                      <Minimize2 size={13} />
                      <span>Minimize</span>
                    </button>
                    <button onClick={closeCompose} title="Close"
                      className="p-1.5 rounded-lg text-[#778DA9] hover:text-white hover:bg-white/10 transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* To field */}
                <div className="px-5 py-3 border-b border-white/10 shrink-0">
                  <div className="[&_label]:text-[#778DA9] [&_input]:bg-white/5 [&_input]:border-white/10 [&_input]:text-white [&_input::placeholder]:text-white/30 [&_input:focus]:border-[#415A77]">
                    {RecipientField}
                  </div>
                </div>

                {/* Message bubbles area — empty state in fullscreen */}
                <div className="flex-1 overflow-y-auto px-5 py-6 min-h-0">
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-[#778DA9]/50">
                    <MessageSquare size={32} className="opacity-30" />
                    <p className="text-sm">Compose a new message below</p>
                  </div>
                </div>

                {/* Composer */}
                <form onSubmit={handleComposeSend} className="border-t border-white/10 px-5 py-4 shrink-0">
                  <div className="flex items-end gap-3">
                    <textarea
                      value={composeBody}
                      onChange={e => setComposeBody(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleComposeSend(e as any) }}
                      rows={3}
                      placeholder="Type a message… (⌘+Enter to send)"
                      className="flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#415A77] focus:ring-1 focus:ring-[#415A77]/40"
                    />
                    <button type="submit"
                      disabled={!composeRecipient || !composeBody.trim() || composeSending}
                      className="flex items-center gap-2 rounded-xl bg-[#415A77] px-5 py-3 text-sm font-semibold text-white hover:bg-[#4f6d8f] disabled:opacity-40 transition-colors shrink-0">
                      <Send size={14} />
                      {composeSending ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                </form>
              </div>
            )
          }

          // Email fullscreen
          return (
            <div className="fixed inset-0 z-50 flex flex-col bg-white">
              {/* Email fullscreen header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 bg-[#0D1B2A] shrink-0">
                <div className="flex items-center gap-2">
                  <Mail size={16} className="text-[#778DA9]" />
                  <span className="text-sm font-semibold text-white">New Email</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setComposeFullscreen(false)} title="Minimize (Esc)"
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-[#778DA9] hover:text-white hover:border-white/30 transition-colors">
                    <Minimize2 size={13} />
                    <span>Minimize</span>
                  </button>
                  <button onClick={closeCompose} title="Close"
                    className="p-1.5 rounded-lg text-[#778DA9] hover:text-white hover:bg-white/10 transition-colors">
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Email fields */}
              <form onSubmit={handleComposeSend} className="flex flex-col flex-1 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 space-y-3 shrink-0">
                  {RecipientField}
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 block">Subject</label>
                    <input
                      value={composeSubject}
                      onChange={e => setComposeSubject(e.target.value)}
                      placeholder="Email subject…"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#415A77] focus:ring-1 focus:ring-[#415A77]/20"
                    />
                  </div>
                </div>

                {/* Body */}
                <div className="flex-1 min-h-0 px-6 pt-4 pb-2 flex flex-col">
                  <textarea
                    required
                    value={composeBody}
                    onChange={e => setComposeBody(e.target.value)}
                    placeholder="Write your message…"
                    className="flex-1 resize-none w-full border-0 outline-none text-sm text-gray-900 placeholder:text-gray-300 leading-relaxed"
                  />
                </div>

                {/* Footer actions */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 shrink-0">
                  <button type="button" onClick={closeCompose}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
                    Discard
                  </button>
                  <button type="submit" disabled={!composeRecipient || !composeBody.trim() || composeSending}
                    className="flex items-center gap-2 rounded-lg bg-[#0D1B2A] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1B263B] disabled:opacity-40 transition-colors">
                    <Send size={14} />
                    {composeSending ? 'Sending…' : 'Send Email'}
                  </button>
                </div>
              </form>
            </div>
          )
        }

        // ── Normal (compact) modal ─────────────────────────────────
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={closeCompose}>
            <div className="bg-white rounded-2xl shadow-2xl w-[500px] flex flex-col"
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">New Message</h3>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setComposeFullscreen(true)} title="Expand to full screen"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-[#415A77] hover:bg-gray-100 transition-colors">
                    <Maximize2 size={15} />
                  </button>
                  <button onClick={closeCompose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                    <X size={15} />
                  </button>
                </div>
              </div>

              <form onSubmit={handleComposeSend} className="p-5 flex flex-col gap-4">

                {RecipientField}

                {/* Channel selector */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Channel</label>
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                    {(['SMS', 'EMAIL'] as const).map(ch => (
                      <button type="button" key={ch} onClick={() => setComposeChannel(ch)}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${composeChannel === ch ? 'bg-[#0D1B2A] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                        {ch}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject (email only) */}
                {composeChannel === 'EMAIL' && (
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Subject</label>
                    <input value={composeSubject} onChange={e => setComposeSubject(e.target.value)}
                      placeholder="Email subject…"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#415A77]" />
                  </div>
                )}

                {/* Message */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Message</label>
                  <textarea required value={composeBody} onChange={e => setComposeBody(e.target.value)}
                    rows={4} placeholder="Write your message…"
                    className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#415A77] focus:ring-1 focus:ring-[#415A77]/20" />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={closeCompose}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Cancel
                  </button>
                  <button type="submit" disabled={!composeRecipient || !composeBody.trim() || composeSending}
                    className="rounded-lg bg-[#0D1B2A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B263B] disabled:opacity-40">
                    {composeSending ? 'Sending…' : `Send ${composeChannel}`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      })()}

      {/* ══ SAVE AS CONTACT MODAL ═══════════════════════════════════════════ */}
      {showSaveContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowSaveContactModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[420px] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Save as Contact</h3>
              <button onClick={() => setShowSaveContactModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handlePromoteContact} className="p-5 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">First Name</label>
                  <input required value={saveContactFirstName} onChange={e => setSaveContactFirstName(e.target.value)}
                    placeholder="First name"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#415A77]" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Last Name</label>
                  <input value={saveContactLastName} onChange={e => setSaveContactLastName(e.target.value)}
                    placeholder="Last name"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#415A77]" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Email</label>
                <input type="email" value={saveContactEmail} onChange={e => setSaveContactEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#415A77]" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Phone</label>
                <input type="tel" value={saveContactPhone} onChange={e => setSaveContactPhone(e.target.value)}
                  placeholder="Phone number"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#415A77]" />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowSaveContactModal(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={savingAsContact || !saveContactFirstName.trim()}
                  className="rounded-lg bg-[#0D1B2A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B263B] disabled:opacity-40">
                  {savingAsContact ? 'Saving…' : 'Save Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
