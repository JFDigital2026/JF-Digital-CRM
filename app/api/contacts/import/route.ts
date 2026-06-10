import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rows } = (await req.json()) as { rows: Record<string, string>[] }
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
  }

  let created = 0
  const errors: Array<{ row: number; error: string }> = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      if (!row.firstName && !row.lastName) {
        errors.push({ row: i + 1, error: 'First or last name required' })
        continue
      }
      await prisma.contact.create({
        data: {
          firstName: row.firstName?.trim() || 'Unknown',
          lastName: row.lastName?.trim() || '',
          email: row.email?.trim() || null,
          phone: row.phone?.trim() || null,
          title: row.title?.trim() || null,
          role: row.role?.trim() || null,
          source: row.source?.trim() || null,
          notes: row.notes?.trim() || null,
          tags: row.tags
            ? row.tags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
            : [],
        },
      })
      created++
    } catch (err) {
      errors.push({ row: i + 1, error: (err as Error).message })
    }
  }

  if (created > 0) {
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        type: 'contacts.imported',
        description: `${created} contact${created !== 1 ? 's' : ''} imported via CSV`,
        metadata: { created, errors: errors.length },
      },
    })
  }

  return NextResponse.json({ created, errors })
}
