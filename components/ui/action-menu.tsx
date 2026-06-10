// "..." trigger dropdown with item array; danger variant turns items red
'use client'

import React from 'react'
import { MoreHorizontal, type LucideIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export interface ActionMenuItem {
  label: string
  icon?: LucideIcon
  onClick: () => void
  danger?: boolean
  separator?: boolean
}

interface ActionMenuProps {
  items: ActionMenuItem[]
  align?: 'start' | 'end'
  className?: string
}

export function ActionMenu({ items, align = 'end', className }: ActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'rounded-lg p-1.5 text-gray-400 outline-none transition-colors hover:bg-gray-100 hover:text-gray-600',
          className
        )}
      >
        <MoreHorizontal size={16} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        {items.map((item, i) => (
          <React.Fragment key={i}>
            {item.separator && i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              variant={item.danger ? 'destructive' : 'default'}
              onClick={item.onClick}
            >
              {item.icon && <item.icon size={14} />}
              {item.label}
            </DropdownMenuItem>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
