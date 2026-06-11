export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'
import { verifyRescheduleToken } from '@/lib/reschedule-token'

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  try {
    const { eventId } = verifyRescheduleToken(params.token)
    const event = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
      include: { calendarConfig: true, contact: true },
    })
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    if (event.status === 'CANCELLED') return NextResponse.json({ error: 'Already cancelled' }, { status: 410 })

    return NextResponse.json({
      title: event.title,
      startTime: event.startTime,
      endTime: event.endTime,
      calName: event.calendarConfig.name,
      calSlug: event.calendarConfig.slug,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid token'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

export async function POST(_req: Request, { params }: { params: { token: string } }) {
  try {
    const { eventId } = verifyRescheduleToken(params.token)
    const event = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
      include: { calendarConfig: true, contact: true },
    })
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    if (event.status === 'CANCELLED') return NextResponse.json({ error: 'Already cancelled', calSlug: event.calendarConfig.slug }, { status: 410 })

    // Cancel the event
    await prisma.calendarEvent.update({
      where: { id: eventId },
      data: { status: 'CANCELLED' },
    })

    // Activity log
    await prisma.activityLog.create({
      data: {
        userId: event.calendarConfig.userId,
        contactId: event.contactId ?? undefined,
        type: 'calendar.cancelled',
        description: `${event.contact?.firstName ?? ''} ${event.contact?.lastName ?? ''} cancelled "${event.calendarConfig.name}" — rescheduling`.trim(),
        metadata: { calendarEventId: eventId, reason: 'reschedule_link' },
      },
    })

    // CRM notification
    await prisma.notification.create({
      data: {
        userId: event.calendarConfig.userId,
        type: 'APPOINTMENT_BOOKED',
        title: 'Appointment Cancelled',
        body: `${event.contact?.firstName ?? 'Someone'} cancelled "${event.calendarConfig.name}" on ${event.startTime.toLocaleString()} and will reschedule.`,
      },
    })

    // Best-effort Google Calendar delete
    if (event.googleEventId && event.calendarConfig.googleAccessToken) {
      try {
        await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.googleEventId}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${event.calendarConfig.googleAccessToken}` },
          }
        )
      } catch (_) {}
    }

    // Notify owner
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY)
        const from = process.env.RESEND_FROM_EMAIL ?? 'bookings@jf-digital.com'
        const notifyEmail = process.env.NOTIFY_EMAIL ?? 'jacefree04@gmail.com'
        const contact = event.contact
        const name = contact ? `${contact.firstName} ${contact.lastName}` : event.title
        const dateDisplay = event.startTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        const timeDisplay = event.startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

        await resend.emails.send({
          from,
          to: notifyEmail,
          subject: `Cancelled & Rescheduling: ${name} — ${event.calendarConfig.name} — ${dateDisplay}`,
          html: `
<body style="margin:0;padding:32px 20px;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
    <tr><td style="background:#b91c1c;padding:20px 28px;">
      <p style="margin:0;color:#fff;font-size:15px;font-weight:700;">Appointment Cancelled — Will Reschedule</p>
    </td></tr>
    <tr><td style="padding:28px;">
      <p style="margin:0 0 8px;color:#374151;font-size:14px;"><strong>${name}</strong> cancelled their <strong>${event.calendarConfig.name}</strong> on ${dateDisplay} at ${timeDisplay} and will reschedule.</p>
      ${contact?.email ? `<p style="margin:0;color:#6b7280;font-size:13px;">Email: ${contact.email}</p>` : ''}
      ${contact?.phone ? `<p style="margin:0;color:#6b7280;font-size:13px;">Phone: ${contact.phone}</p>` : ''}
    </td></tr>
  </table>
</body>`,
        })
      } catch (_) {}
    }

    return NextResponse.json({ success: true, calSlug: event.calendarConfig.slug })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
