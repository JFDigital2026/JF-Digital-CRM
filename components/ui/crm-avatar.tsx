'use client'

import React from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

// Deterministic hue rotation seeded from name for avatar gradient variety
const BASE_PAIRS: Array<[string, string]> = [
  ['#415A77', '#778DA9'],
  ['#2E4057', '#6B8CAE'],
  ['#1B4F72', '#5499C7'],
  ['#1A5276', '#4A90BF'],
  ['#174A7E', '#5B8DB8'],
  ['#0E3460', '#3D7EAA'],
  ['#2C3E50', '#5D8AA8'],
  ['#34495E', '#7F8C8D'],
  ['#2E4057', '#778DA9'],
  ['#1F3A5F', '#6E9EC5'],
]

function getGradientFromName(name: string): [string, string] {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return BASE_PAIRS[Math.abs(hash) % BASE_PAIRS.length]
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

interface CRMAvatarProps {
  name: string
  src?: string
  size?: 'sm' | 'default' | 'lg'
  className?: string
}

export function CRMAvatar({ name, src, size = 'default', className }: CRMAvatarProps) {
  const [from, to] = getGradientFromName(name)
  const initials = getInitials(name)
  const fontSize = size === 'sm' ? 11 : size === 'lg' ? 16 : 13

  return (
    <Avatar size={size} className={className}>
      {src && <AvatarImage src={src} alt={name} />}
      <AvatarFallback
        className={cn('font-semibold text-white')}
        style={{
          background: `linear-gradient(135deg, ${from}, ${to})`,
          fontSize,
        }}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}
