import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { readFile } from 'fs/promises'
import { extname } from 'path'
import { resolveStoredFilePath } from '@/lib/uploads'
import { can } from '@/lib/permissions'

const CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
  '.rtf': 'application/rtf',
  '.zip': 'application/zip',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const file = await prisma.fileAttachment.findUnique({ where: { id: params.id } })
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Authorize the read against the parent record's view permission. The uploader
  // can always fetch their own file; otherwise require view on the contact/company
  // the file is attached to (a bare session check let any user read any file).
  const isOwner = file.uploadedBy === session.user.id
  const parentModule = file.companyId && !file.contactId ? 'companies' : 'contacts'
  if (!isOwner && !can(session, parentModule, 'view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const abs = resolveStoredFilePath(file.url)
  if (!abs) return NextResponse.json({ error: 'File unavailable' }, { status: 404 })

  const data = await readFile(abs)
  const ext = extname(file.name || file.url).toLowerCase()
  const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream'

  // Always force download and never render inline. With the global nosniff header
  // this neutralizes content-based XSS even for older files with risky types.
  const safeDownloadName = (file.name || 'download').replace(/["\r\n]/g, '_')

  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${safeDownloadName}"`,
      'Content-Length': String(data.length),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  })
}
