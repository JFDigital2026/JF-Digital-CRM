import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { basename, extname, join } from 'path'
import { UPLOAD_DIR } from '@/lib/uploads'

// 25 MB per file.
const MAX_SIZE = 25 * 1024 * 1024

// Allowlist of safe document/image extensions. HTML/SVG/JS and friends are
// intentionally excluded so an upload can never be served as executable content.
const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.doc', '.docx',
  '.xls', '.xlsx', '.csv',
  '.ppt', '.pptx',
  '.txt', '.rtf',
  '.zip',
])

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Strip any directory component and reduce to a safe, single-segment filename.
// path.basename removes POSIX separators; we also strip backslashes, control
// chars, leading dots (e.g. ".htaccess"), and cap the length.
function sanitizeFilename(raw: string): string {
  const base = basename(raw).replace(/\\/g, '_').replace(/[\x00-\x1f]/g, '')
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '')
  return cleaned.slice(0, 200) || 'file'
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

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: `File exceeds the ${Math.round(MAX_SIZE / (1024 * 1024))} MB limit` },
      { status: 413 }
    )
  }

  const safeName = sanitizeFilename(file.name)
  const ext = extname(safeName).toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json(
      { error: 'File type not allowed' },
      { status: 415 }
    )
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
      : slugify(contactId)
    subDir = `contacts/${name || 'unknown'}`
  } else if (companyId) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    })
    const name = company ? slugify(company.name) : slugify(companyId)
    subDir = `companies/${name || 'unknown'}`
  } else {
    subDir = 'general'
  }

  // Private storage dir, outside public/ — files are only reachable through the
  // authenticated download route, never served statically.
  const uploadDir = join(UPLOAD_DIR, subDir)
  await mkdir(uploadDir, { recursive: true })

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const filename = resolveFilename(uploadDir, safeName)
  await writeFile(join(uploadDir, filename), buffer)

  const attachment = await prisma.fileAttachment.create({
    data: {
      name: file.name.slice(0, 255),
      // Disk-relative path (private). The client downloads via the API route below.
      url: `${subDir}/${filename}`,
      size: file.size,
      type: file.type || 'application/octet-stream',
      uploadedBy: session.user.id,
      contactId,
      companyId,
    },
  })

  return NextResponse.json(attachment, { status: 201 })
}
