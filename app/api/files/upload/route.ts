import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Resolves filename collision: "file.pdf" → "file-2.pdf" → "file-3.pdf"
function resolveFilename(dir: string, original: string): string {
  if (!existsSync(join(dir, original))) return original
  const dot = original.lastIndexOf('.')
  const base = dot !== -1 ? original.slice(0, dot) : original
  const ext = dot !== -1 ? original.slice(dot) : ''
  let i = 2
  while (existsSync(join(dir, `${base}-${i}${ext}`))) i++
  return `${base}-${i}${ext}`
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const contactId = (formData.get('contactId') as string) || null
  const companyId = (formData.get('companyId') as string) || null

  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  // Determine subfolder from contact/company name
  let subDir: string

  if (contactId) {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { firstName: true, lastName: true },
    })
    const name = contact
      ? slugify(`${contact.firstName}-${contact.lastName}`)
      : contactId
    subDir = `contacts/${name}`
  } else if (companyId) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    })
    const name = company ? slugify(company.name) : companyId
    subDir = `companies/${name}`
  } else {
    subDir = 'general'
  }

  const uploadDir = join(process.cwd(), 'public', 'uploads', subDir)
  await mkdir(uploadDir, { recursive: true })

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const filename = resolveFilename(uploadDir, file.name)
  await writeFile(join(uploadDir, filename), buffer)

  const attachment = await prisma.fileAttachment.create({
    data: {
      name: file.name,
      url: `/uploads/${subDir}/${filename}`,
      size: file.size,
      type: file.type || 'application/octet-stream',
      uploadedBy: session.user.id,
      contactId,
      companyId,
    },
  })

  return NextResponse.json(attachment, { status: 201 })
}
