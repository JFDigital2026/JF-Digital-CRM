import { Resend } from 'resend'
import { requireAuth } from '@/lib/api-v1/auth'
import { ok, err } from '@/lib/api-v1/response'
import { prisma } from '@/lib/prisma'

// POST /api/v1/email/send  { to, subject, html?, text?, contactId? }
// Generic transactional send used by the n8n event workflows (no-response
// follow-up, appointment-booked). n8n does the templating; the CRM owns the
// Resend credentials and, when contactId is supplied, logs the send to the
// contact timeline.
export async function POST(req: Request) {
  const auth = await requireAuth(req, 'messages:write')
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const { to, subject, html, text, contactId } = body

  if (!to || typeof to !== 'string') {
    return err('VALIDATION_ERROR', 'to is required')
  }
  if (!subject || typeof subject !== 'string') {
    return err('VALIDATION_ERROR', 'subject is required')
  }
  if (typeof html !== 'string' && typeof text !== 'string') {
    return err('VALIDATION_ERROR', 'html or text is required')
  }

  const from = process.env.RESEND_FROM_EMAIL ?? 'bookings@jf-digital.com'
  const resend = new Resend(process.env.RESEND_API_KEY)

  let id: string | undefined
  try {
    const res = await resend.emails.send({
      from,
      to,
      subject,
      ...(typeof html === 'string' ? { html } : { text: text as string }),
    })
    id = res.data?.id
  } catch {
    return err('EMAIL_SEND_FAILED', 'Failed to send email', 502)
  }

  if (typeof contactId === 'string' && contactId) {
    await prisma.activityLog
      .create({
        data: {
          contactId,
          userId: auth.userId,
          type: 'email.sent',
          description: `Email sent: ${subject}`,
          metadata: { to, subject, provider: 'resend', messageId: id ?? null },
        },
      })
      .catch(() => {})
  }

  return ok({ sent: true, messageId: id ?? null })
}
