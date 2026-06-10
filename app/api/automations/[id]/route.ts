import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const automation = await prisma.automation.findUnique({ where: { id: params.id } })
  if (!automation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(automation)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const automation = await prisma.automation.findUnique({ where: { id: params.id } })
  if (!automation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()

  // Only allow toggling active state from this route
  if ('active' in body && Object.keys(body).length === 1) {
    const updated = await prisma.automation.update({
      where: { id: params.id },
      data: { active: Boolean(body.active) },
    })
    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: 'Use /copy route for copy edits' }, { status: 400 })
}
