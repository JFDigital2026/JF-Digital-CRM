import type { MetricDefinition } from '@/lib/metrics/types'
import { rate, mean, countSeries, rateSeries, daysBetween } from '@/lib/metrics/util'

export const activityMetrics: MetricDefinition[] = [
  {
    id: 'activity.meetingsBooked',
    label: 'Meetings Booked',
    category: 'activity',
    unit: 'number',
    description: 'Calendar events created in the period.',
    higherIsBetter: true,
    resolve: async (l) => (await l.eventsCreated()).length,
    series: async (l, ctx) =>
      countSeries((await l.eventsCreated()).map((e) => ({ date: e.createdAt })), ctx),
  },
  {
    id: 'activity.meetingsCompleted',
    label: 'Meetings Completed',
    category: 'activity',
    unit: 'number',
    description: 'Meetings that actually took place.',
    higherIsBetter: true,
    resolve: async (l) =>
      (await l.eventsCreated()).filter((e) => e.status === 'COMPLETED').length,
  },
  {
    id: 'activity.showRate',
    label: 'Show Rate',
    category: 'activity',
    unit: 'percent',
    description: 'Completed meetings as a share of completed plus no-show.',
    higherIsBetter: true,
    resolve: async (l) => {
      const events = await l.eventsCreated()
      const completed = events.filter((e) => e.status === 'COMPLETED').length
      const noShow = events.filter((e) => e.status === 'NO_SHOW').length
      return rate(completed, completed + noShow)
    },
  },
  {
    id: 'activity.noShowRate',
    label: 'No-Show Rate',
    category: 'activity',
    unit: 'percent',
    description: 'No-shows as a share of meetings that reached a decided state.',
    higherIsBetter: false,
    resolve: async (l) => {
      const events = await l.eventsByStart()
      const completed = events.filter((e) => e.status === 'COMPLETED').length
      const noShow = events.filter((e) => e.status === 'NO_SHOW').length
      return rate(noShow, completed + noShow)
    },
    series: async (l, ctx) =>
      rateSeries(
        (await l.eventsByStart()).map((e) => ({
          date: e.createdAt,
          hit: e.status === 'NO_SHOW',
        })),
        ctx
      ),
  },
  {
    id: 'activity.cancellationRate',
    label: 'Cancellation Rate',
    category: 'activity',
    unit: 'percent',
    description: 'Cancelled meetings as a share of all booked.',
    higherIsBetter: false,
    resolve: async (l) => {
      const events = await l.eventsCreated()
      return rate(events.filter((e) => e.status === 'CANCELLED').length, events.length)
    },
  },
  {
    id: 'activity.bookingLeadTime',
    label: 'Booking Lead Time',
    category: 'activity',
    unit: 'days',
    description: 'Mean days between a meeting being booked and it taking place.',
    higherIsBetter: false,
    resolve: async (l) =>
      mean((await l.eventsCreated()).map((e) => daysBetween(e.createdAt, e.startTime))),
  },
  {
    id: 'activity.emailsSent',
    label: 'Emails Sent (in CRM)',
    category: 'activity',
    unit: 'number',
    description:
      'Outbound emails sent from the CRM. Separate from cold outreach, which is tracked under Outbound.',
    higherIsBetter: true,
    resolve: async (l) =>
      (await l.outboundMessages()).filter((m) => m.channel === 'EMAIL').length,
    series: async (l, ctx) =>
      countSeries(
        (await l.outboundMessages())
          .filter((m) => m.channel === 'EMAIL')
          .map((m) => ({ date: m.createdAt })),
        ctx
      ),
  },
  {
    id: 'activity.smsSent',
    label: 'SMS Sent',
    category: 'activity',
    unit: 'number',
    description: 'Outbound SMS messages in the period.',
    higherIsBetter: true,
    resolve: async (l) =>
      (await l.outboundMessages()).filter((m) => m.channel === 'SMS').length,
  },
  {
    id: 'activity.totalOutboundMessages',
    label: 'Outbound Messages',
    category: 'activity',
    unit: 'number',
    description: 'All outbound messages across every channel.',
    higherIsBetter: true,
    resolve: async (l) => (await l.outboundMessages()).length,
  },
  {
    id: 'activity.inboundMessages',
    label: 'Inbound Messages',
    category: 'activity',
    unit: 'number',
    description: 'Messages received from contacts in the period.',
    higherIsBetter: true,
    resolve: async (l) => (await l.inboundMessages()).length,
    series: async (l, ctx) =>
      countSeries((await l.inboundMessages()).map((m) => ({ date: m.createdAt })), ctx),
  },
  {
    id: 'activity.responseTimeHours',
    label: 'Response Time',
    category: 'activity',
    unit: 'hours',
    description:
      'Median hours between an inbound message and the first outbound reply to that contact.',
    higherIsBetter: false,
    resolve: async (l) => {
      const [inbound, outbound] = await Promise.all([
        l.inboundMessages(),
        l.outboundMessages(),
      ])
      const repliesByContact = new Map<string, Date[]>()
      for (const m of outbound) {
        if (!m.contactId) continue
        const list = repliesByContact.get(m.contactId) ?? []
        list.push(new Date(m.createdAt))
        repliesByContact.set(m.contactId, list)
      }
      Array.from(repliesByContact.values()).forEach((list) =>
        list.sort((a: Date, b: Date) => a.getTime() - b.getTime())
      )

      const gaps: number[] = []
      for (const m of inbound) {
        if (!m.contactId) continue
        const replies = repliesByContact.get(m.contactId)
        if (!replies) continue
        const inboundAt = new Date(m.createdAt).getTime()
        const next = replies.find((r) => r.getTime() > inboundAt)
        if (next) gaps.push((next.getTime() - inboundAt) / 3_600_000)
      }
      if (!gaps.length) return null
      gaps.sort((a, b) => a - b)
      const mid = Math.floor(gaps.length / 2)
      return gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2
    },
  },
  {
    id: 'activity.tasksCreated',
    label: 'Tasks Created',
    category: 'activity',
    unit: 'number',
    description: 'Tasks created in the period.',
    higherIsBetter: true,
    resolve: async (l) => (await l.tasksCreated()).length,
  },
  {
    id: 'activity.followUpRate',
    label: 'Follow-Up Rate',
    category: 'activity',
    unit: 'percent',
    description: 'Share of tasks that are follow-ups to another task.',
    higherIsBetter: true,
    resolve: async (l) => {
      const tasks = await l.tasksCreated()
      return rate(tasks.filter((t) => t.followUpTaskId !== null).length, tasks.length)
    },
  },
  {
    id: 'activity.taskCompletionRate',
    label: 'Task Completion Rate',
    category: 'activity',
    unit: 'percent',
    description: 'Tasks created in the period that are now complete.',
    higherIsBetter: true,
    resolve: async (l) => {
      const tasks = await l.tasksCreated()
      return rate(tasks.filter((t) => t.status === 'COMPLETED').length, tasks.length)
    },
  },
  {
    id: 'activity.totalActivity',
    label: 'Total Activity',
    category: 'activity',
    unit: 'number',
    description: 'Messages, meetings and tasks combined — overall throughput.',
    higherIsBetter: true,
    resolve: async (l) => {
      const [out, events, tasks] = await Promise.all([
        l.outboundMessages(),
        l.eventsCreated(),
        l.tasksCreated(),
      ])
      return out.length + events.length + tasks.length
    },
    series: async (l, ctx) => {
      const [out, events, tasks] = await Promise.all([
        l.outboundMessages(),
        l.eventsCreated(),
        l.tasksCreated(),
      ])
      return countSeries(
        [
          ...out.map((m) => ({ date: m.createdAt })),
          ...events.map((e) => ({ date: e.createdAt })),
          ...tasks.map((t) => ({ date: t.createdAt })),
        ],
        ctx
      )
    },
  },
  {
    id: 'activity.reminderDeliveryRate',
    label: 'Reminder Delivery Rate',
    category: 'activity',
    unit: 'percent',
    description:
      'Share of booked meetings where the 24-hour reminder was actually sent.',
    higherIsBetter: true,
    unavailable: 'needs-manual-entry',
  },
]
