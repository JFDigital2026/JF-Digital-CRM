'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { CRMAvatar } from '@/components/ui/crm-avatar'
import { ChevronDown, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Contact {
  id: string
  firstName: string
  lastName: string
  title?: string | null
  role?: string | null
  leadStatus: string
}

interface OrgChartProps {
  contacts: Contact[]
  hierarchyJson: Record<string, string | null> | null
  onUpdate: (hierarchy: Record<string, string | null>) => void
}

interface TreeNode {
  contact: Contact
  children: TreeNode[]
}

function buildTree(contacts: Contact[], hierarchy: Record<string, string | null>): TreeNode[] {
  const contactMap = new Map(contacts.map((c) => [c.id, c]))
  const childrenMap = new Map<string | null, string[]>()

  for (const [contactId, managerId] of Object.entries(hierarchy)) {
    const parentKey = managerId ?? null
    if (!childrenMap.has(parentKey)) childrenMap.set(parentKey, [])
    childrenMap.get(parentKey)!.push(contactId)
  }

  function buildNode(contactId: string): TreeNode {
    const contact = contactMap.get(contactId)!
    const childIds = childrenMap.get(contactId) ?? []
    return {
      contact,
      children: childIds
        .filter((id) => contactMap.has(id))
        .map(buildNode),
    }
  }

  const rootIds = childrenMap.get(null) ?? []
  return rootIds.filter((id) => contactMap.has(id)).map(buildNode)
}

interface SetManagerDropdownProps {
  contactId: string
  currentManagerId: string | null
  contacts: Contact[]
  hierarchy: Record<string, string | null>
  onSet: (contactId: string, managerId: string | null) => void
}

function SetManagerDropdown({ contactId, currentManagerId, contacts, hierarchy, onSet }: SetManagerDropdownProps) {
  const [open, setOpen] = useState(false)

  // Prevent cycles: cannot set a descendant as a manager
  const getDescendants = useCallback((id: string, hier: Record<string, string | null>): Set<string> => {
    const descendants = new Set<string>()
    const queue = [id]
    while (queue.length) {
      const curr = queue.shift()!
      for (const [cId, mId] of Object.entries(hier)) {
        if (mId === curr && !descendants.has(cId)) {
          descendants.add(cId)
          queue.push(cId)
        }
      }
    }
    return descendants
  }, [])

  const descendants = useMemo(() => getDescendants(contactId, hierarchy), [contactId, hierarchy, getDescendants])

  const eligible = contacts.filter(
    (c) => c.id !== contactId && !descendants.has(c.id)
  )

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
      >
        Manager <ChevronDown size={9} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 w-44 rounded-lg border border-gray-200 bg-white shadow-xl">
            <div className="py-1">
              {currentManagerId && (
                <button
                  type="button"
                  onClick={() => { onSet(contactId, null); setOpen(false) }}
                  className="block w-full px-3 py-1.5 text-left text-xs text-red-500 hover:bg-red-50"
                >
                  — Remove Manager
                </button>
              )}
              {eligible.length === 0 && (
                <p className="px-3 py-1.5 text-xs text-gray-400 italic">No eligible contacts</p>
              )}
              {eligible.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { onSet(contactId, c.id); setOpen(false) }}
                  className={cn(
                    'block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50',
                    hierarchy[contactId] === c.id ? 'font-semibold text-[#415A77]' : 'text-gray-700'
                  )}
                >
                  {c.firstName} {c.lastName}
                  {c.title && <span className="ml-1 text-gray-400">· {c.title}</span>}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

interface NodeCardProps {
  node: TreeNode
  allContacts: Contact[]
  hierarchy: Record<string, string | null>
  focused: string | null
  onFocus: (id: string) => void
  onSetManager: (contactId: string, managerId: string | null) => void
  isRoot?: boolean
}

function NodeCard({ node, allContacts, hierarchy, focused, onFocus, onSetManager, isRoot }: NodeCardProps) {
  const { contact, children } = node
  const name = `${contact.firstName} ${contact.lastName}`

  return (
    <div className="flex flex-col items-center">
      {/* Vertical line above (except root) */}
      {!isRoot && (
        <div className="h-5 w-px bg-gray-200" />
      )}

      {/* Node card */}
      <div
        onClick={() => onFocus(contact.id)}
        className={cn(
          'cursor-pointer rounded-lg border bg-white px-3 py-2 shadow-sm text-xs transition-all hover:shadow-md',
          focused === contact.id
            ? 'border-[#415A77] ring-2 ring-[#415A77]/20'
            : 'border-gray-200'
        )}
        style={{ minWidth: 140, maxWidth: 180 }}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <CRMAvatar name={name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-gray-900 truncate text-[11px] leading-tight">{name}</p>
            {(contact.title || contact.role) && (
              <p className="text-[10px] text-gray-400 truncate">{contact.title ?? contact.role}</p>
            )}
          </div>
        </div>
        <SetManagerDropdown
          contactId={contact.id}
          currentManagerId={hierarchy[contact.id] ?? null}
          contacts={allContacts}
          hierarchy={hierarchy}
          onSet={onSetManager}
        />
      </div>

      {/* Children */}
      {children.length > 0 && (
        <div className="flex flex-col items-center">
          {/* Vertical connector down */}
          <div className="h-5 w-px bg-gray-200" />

          {/* Horizontal bar + children */}
          <div className="relative flex gap-6 items-start">
            {/* Horizontal connecting line */}
            {children.length > 1 && (
              <div
                className="absolute top-0 bg-gray-200"
                style={{
                  height: 1,
                  left: '50%',
                  right: 'auto',
                  // spans from first to last child center — use CSS custom approach
                  transform: 'none',
                  width: '100%',
                }}
              />
            )}
            {children.map((child, i) => (
              <div key={child.contact.id} className="relative flex flex-col items-center">
                {/* Per-child vertical tick up */}
                {children.length > 1 && (
                  <div className="h-5 w-px bg-gray-200" />
                )}
                <NodeCard
                  node={child}
                  allContacts={allContacts}
                  hierarchy={hierarchy}
                  focused={focused}
                  onFocus={onFocus}
                  onSetManager={onSetManager}
                  isRoot={false}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function OrgChart({ contacts, hierarchyJson, onUpdate }: OrgChartProps) {
  const [focused, setFocused] = useState<string | null>(null)
  const [scale, setScale] = useState(1)

  const hierarchy = useMemo<Record<string, string | null>>(
    () => hierarchyJson ?? {},
    [hierarchyJson]
  )

  const treeRoots = useMemo(() => {
    if (!Object.keys(hierarchy).length) return []
    return buildTree(contacts, hierarchy)
  }, [contacts, hierarchy])

  const handleSetManager = useCallback(
    (contactId: string, managerId: string | null) => {
      const updated = { ...hierarchy, [contactId]: managerId }
      // Add all contacts that aren't in hierarchy as root nodes
      for (const c of contacts) {
        if (!(c.id in updated)) updated[c.id] = null
      }
      onUpdate(updated)
    },
    [hierarchy, contacts, onUpdate]
  )

  const initHierarchy = useCallback(() => {
    const h: Record<string, string | null> = {}
    for (const c of contacts) h[c.id] = null
    onUpdate(h)
  }, [contacts, onUpdate])

  const hasHierarchy = Object.keys(hierarchy).length > 0

  if (!contacts.length) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-sm text-gray-400">
        No contacts to display in org chart.
      </div>
    )
  }

  // Flat list if no hierarchy set
  if (!hasHierarchy) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {contacts.length > 1
              ? 'Set managers to build the org chart'
              : 'Add more contacts to build an org chart'}
          </p>
          {contacts.length > 1 && (
            <button
              type="button"
              onClick={initHierarchy}
              className="rounded-lg bg-[#0D1B2A] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1B263B] transition-colors"
            >
              Build Org Chart
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {contacts.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white p-2.5"
            >
              <CRMAvatar name={`${c.firstName} ${c.lastName}`} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {c.firstName} {c.lastName}
                </p>
                {(c.title || c.role) && (
                  <p className="text-xs text-gray-400">{c.title ?? c.role}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Contacts not yet in hierarchy (added after chart init)
  const inHierarchy = new Set(Object.keys(hierarchy))
  const unassigned = contacts.filter((c) => !inHierarchy.has(c.id))

  return (
    <div className="flex flex-col gap-3">
      {/* Controls */}
      <div className="flex items-center gap-2 justify-end">
        <button
          type="button"
          onClick={() => setScale((s) => Math.min(1.5, +(s + 0.1).toFixed(1)))}
          className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50"
          title="Zoom in"
        >
          <ZoomIn size={13} />
        </button>
        <button
          type="button"
          onClick={() => setScale((s) => Math.max(0.5, +(s - 0.1).toFixed(1)))}
          className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50"
          title="Zoom out"
        >
          <ZoomOut size={13} />
        </button>
        <button
          type="button"
          onClick={() => setScale(1)}
          className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50"
          title="Reset zoom"
        >
          <RotateCcw size={13} />
        </button>
        <span className="text-xs text-gray-400">{Math.round(scale * 100)}%</span>
      </div>

      {/* Tree */}
      <div className="overflow-auto rounded-xl border border-gray-100 bg-gray-50 p-4">
        <div
          style={{ transform: `scale(${scale})`, transformOrigin: 'top center', transition: 'transform 0.15s ease' }}
        >
          {treeRoots.length === 0 ? (
            <p className="py-6 text-center text-xs text-gray-400">
              No root nodes — assign managers to build the tree.
            </p>
          ) : (
            <div className="flex gap-8 justify-center">
              {treeRoots.map((root) => (
                <NodeCard
                  key={root.contact.id}
                  node={root}
                  allContacts={contacts}
                  hierarchy={hierarchy}
                  focused={focused}
                  onFocus={setFocused}
                  onSetManager={handleSetManager}
                  isRoot
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Unassigned contacts */}
      {unassigned.length > 0 && (
        <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
          <p className="mb-2 text-xs font-medium text-amber-700">
            {unassigned.length} contact{unassigned.length > 1 ? 's' : ''} not yet in chart
          </p>
          <div className="flex flex-wrap gap-2">
            {unassigned.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSetManager(c.id, null)}
                className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-white px-2.5 py-1 text-xs text-gray-700 hover:bg-amber-50"
              >
                <CRMAvatar name={`${c.firstName} ${c.lastName}`} size="sm" />
                {c.firstName} {c.lastName}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
