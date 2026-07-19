import { requireAuth } from '@/lib/api-v1/auth'
import { ok, err } from '@/lib/api-v1/response'
import { getDueReminders, isReminderTiming } from '@/lib/reminder-email'

// GET /api/v1/reminders/due?timing=24h|1h
// Returns confirmed appointments whose reminder of this timing is now due and
// not yet sent. n8n's Schedule trigger polls this, then POSTs each id back to
// /api/v1/reminders/send.
export async function GET(req: Request) {
  const auth = await requireAuth(req, 'calendar:read')
  if (!auth.ok) return auth.response

  const timing = new URL(req.url).searchParams.get('timing')
  if (!isReminderTiming(timing)) {
    return err('VALIDATION_ERROR', "timing must be '24h' or '1h'")
  }

  const events = await getDueReminders(timing)
  const due = events
    .filter((e) => e.contact?.email)
    .map((e) => ({
      eventId: e.id,
      timing,
      email: e.contact?.email,
      firstName: e.contact?.firstName ?? e.title.split(' ')[0],
      startTime: e.startTime.toISOString(),
    }))

  return ok(due, { count: due.length })
}
