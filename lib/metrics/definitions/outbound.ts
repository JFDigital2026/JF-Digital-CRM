import type { MetricDefinition } from '@/lib/metrics/types'
import { rate, sum, outboundSeries } from '@/lib/metrics/util'

/**
 * Cold-email KPIs. The CRM does not compute these — it receives daily rollups
 * from the Lead Gen dashboard via POST /api/v1/outbound-stats, which owns the
 * IMAP scan (sends, replies, opt-outs) and the tracking-pixel table (opens).
 *
 * Every resolver here returns null when no rows have landed yet, so an unsynced
 * CRM shows "no data" rather than a confident zero.
 */
export const outboundMetrics: MetricDefinition[] = [
  {
    id: 'outbound.sent',
    label: 'Cold Emails Sent',
    category: 'outbound',
    unit: 'number',
    description:
      'Outbound cold emails sent in the period, first touch plus follow-ups, across all sending inboxes.',
    higherIsBetter: true,
    resolve: async (l) => {
      const rows = await l.outboundStats()
      if (!rows.length) return null
      return sum(rows.map((r) => r.sent))
    },
    series: (l, ctx) => outboundSeries(l, ctx, (r) => r.sent),
  },
  {
    id: 'outbound.openRate',
    label: 'Open Rate',
    category: 'outbound',
    unit: 'percent',
    description:
      'Unique opens divided by emails sent. Counts real opens only — scanner traffic is filtered upstream by user agent.',
    higherIsBetter: true,
    resolve: async (l) => {
      const rows = await l.outboundStats()
      if (!rows.length) return null
      return rate(sum(rows.map((r) => r.uniqueOpens)), sum(rows.map((r) => r.sent)))
    },
  },
  {
    id: 'outbound.replyRate',
    label: 'Response Rate',
    category: 'outbound',
    unit: 'percent',
    description:
      'Genuine prospect replies divided by emails sent. Opt-out replies are excluded and counted separately.',
    higherIsBetter: true,
    resolve: async (l) => {
      const rows = await l.outboundStats()
      if (!rows.length) return null
      return rate(sum(rows.map((r) => r.replied)), sum(rows.map((r) => r.sent)))
    },
  },
  {
    id: 'outbound.replies',
    label: 'Replies Received',
    category: 'outbound',
    unit: 'number',
    description: 'Count of genuine prospect replies in the period.',
    higherIsBetter: true,
    resolve: async (l) => {
      const rows = await l.outboundStats()
      if (!rows.length) return null
      return sum(rows.map((r) => r.replied))
    },
    series: (l, ctx) => outboundSeries(l, ctx, (r) => r.replied),
  },
  {
    id: 'outbound.positiveReplies',
    label: 'Positive Replies',
    category: 'outbound',
    unit: 'number',
    description:
      'Replies read as genuine interest, excluding rejections. Classified upstream by rule, correctable by hand on the Lead Gen dashboard.',
    higherIsBetter: true,
    resolve: async (l) => {
      const rows = await l.outboundStats()
      if (!rows.length) return null
      return sum(rows.map((r) => r.positiveReplies))
    },
    series: (l, ctx) => outboundSeries(l, ctx, (r) => r.positiveReplies),
  },
  {
    id: 'outbound.positiveReplyRate',
    label: 'Positive Response Rate',
    category: 'outbound',
    unit: 'percent',
    description:
      'Interested replies divided by emails sent. Response Rate counts every reply including "not interested" — this is the one that moves when the offer or the targeting changes rather than the subject line.',
    higherIsBetter: true,
    resolve: async (l) => {
      const rows = await l.outboundStats()
      if (!rows.length) return null
      return rate(sum(rows.map((r) => r.positiveReplies)), sum(rows.map((r) => r.sent)))
    },
  },
  {
    id: 'outbound.replyQuality',
    label: 'Reply Quality',
    category: 'outbound',
    unit: 'percent',
    description:
      'Share of replies that were interested rather than a rejection. Falling here while Response Rate holds means the copy is provoking answers but the offer or the list is wrong.',
    higherIsBetter: true,
    resolve: async (l) => {
      const rows = await l.outboundStats()
      if (!rows.length) return null
      return rate(sum(rows.map((r) => r.positiveReplies)), sum(rows.map((r) => r.replied)))
    },
  },
  {
    id: 'outbound.optOuts',
    label: 'Opt Outs',
    category: 'outbound',
    unit: 'number',
    description: 'Unsubscribe requests received in the period.',
    higherIsBetter: false,
    resolve: async (l) => {
      const rows = await l.outboundStats()
      if (!rows.length) return null
      return sum(rows.map((r) => r.optedOut))
    },
    series: (l, ctx) => outboundSeries(l, ctx, (r) => r.optedOut),
  },
  {
    id: 'outbound.optOutRate',
    label: 'Opt-Out Rate',
    category: 'outbound',
    unit: 'percent',
    description:
      'Opt-outs divided by emails sent. Climbing past roughly 1% means the targeting or the copy is wrong, not the volume.',
    higherIsBetter: false,
    resolve: async (l) => {
      const rows = await l.outboundStats()
      if (!rows.length) return null
      return rate(sum(rows.map((r) => r.optedOut)), sum(rows.map((r) => r.sent)))
    },
  },
  {
    id: 'outbound.uniqueOpens',
    label: 'Unique Opens',
    category: 'outbound',
    unit: 'number',
    description: 'Distinct recipients who opened at least once.',
    higherIsBetter: true,
    resolve: async (l) => {
      const rows = await l.outboundStats()
      if (!rows.length) return null
      return sum(rows.map((r) => r.uniqueOpens))
    },
    series: (l, ctx) => outboundSeries(l, ctx, (r) => r.uniqueOpens),
  },
  {
    id: 'outbound.bounceRate',
    label: 'Bounce Rate',
    category: 'outbound',
    unit: 'percent',
    description:
      'Hard and soft bounces divided by sends. The earliest warning that inbox reputation is slipping.',
    higherIsBetter: false,
    resolve: async (l) => {
      const rows = await l.outboundStats()
      if (!rows.length) return null
      return rate(sum(rows.map((r) => r.bounced)), sum(rows.map((r) => r.sent)))
    },
  },
  {
    id: 'outbound.suppressedOpens',
    label: 'Suppressed (Bot) Opens',
    category: 'outbound',
    unit: 'number',
    description:
      'Pixel hits discarded as security-scanner traffic. If this climbs relative to real opens, treat the open rate as inflated.',
    higherIsBetter: false,
    resolve: async (l) => {
      const rows = await l.outboundStats()
      if (!rows.length) return null
      return sum(rows.map((r) => r.suppressedOpens))
    },
    series: (l, ctx) => outboundSeries(l, ctx, (r) => r.suppressedOpens),
  },
  {
    id: 'outbound.activeSendingDays',
    label: 'Active Sending Days',
    category: 'outbound',
    unit: 'number',
    description:
      'Days in the period with at least one send. Outbound fails from inconsistency far more often than from bad copy.',
    higherIsBetter: true,
    resolve: async (l) => {
      const rows = await l.outboundStats()
      if (!rows.length) return null
      return rows.filter((r) => r.sent > 0).length
    },
  },
  {
    id: 'outbound.sendsPerActiveDay',
    label: 'Sends per Active Day',
    category: 'outbound',
    unit: 'number',
    description: 'Average send volume on days when sending actually happened.',
    higherIsBetter: true,
    resolve: async (l) => {
      const rows = await l.outboundStats()
      if (!rows.length) return null
      const active = rows.filter((r) => r.sent > 0)
      if (!active.length) return null
      return sum(active.map((r) => r.sent)) / active.length
    },
  },
  {
    id: 'outbound.linkedinSent',
    label: 'LinkedIn Touches Sent',
    category: 'outbound',
    unit: 'number',
    description: 'Second-touch LinkedIn messages sent in the period.',
    higherIsBetter: true,
    resolve: async (l) => {
      const rows = await l.outboundStats()
      if (!rows.length) return null
      return sum(rows.map((r) => r.linkedinSent))
    },
    series: (l, ctx) => outboundSeries(l, ctx, (r) => r.linkedinSent),
  },
  {
    id: 'outbound.totalTouches',
    label: 'Total Outbound Touches',
    category: 'outbound',
    unit: 'number',
    description: 'Emails plus LinkedIn messages sent in the period.',
    higherIsBetter: true,
    resolve: async (l) => {
      const rows = await l.outboundStats()
      if (!rows.length) return null
      return sum(rows.map((r) => r.sent + r.linkedinSent))
    },
  },
  {
    id: 'outbound.meetingsPer100Emails',
    label: 'Meetings per 100 Emails',
    category: 'outbound',
    unit: 'number',
    description:
      'Meetings booked per hundred cold emails. The single number that decides whether outbound is working.',
    higherIsBetter: true,
    resolve: async (l) => {
      const [rows, events] = await Promise.all([l.outboundStats(), l.eventsCreated()])
      if (!rows.length) return null
      const sent = sum(rows.map((r) => r.sent))
      if (!sent) return null
      return (events.length / sent) * 100
    },
  },
  {
    id: 'outbound.replyToMeetingRate',
    label: 'Reply → Meeting Rate',
    category: 'outbound',
    unit: 'percent',
    description:
      'Meetings booked divided by genuine replies. Separates a copy problem from a call-booking problem.',
    higherIsBetter: true,
    resolve: async (l) => {
      const [rows, events] = await Promise.all([l.outboundStats(), l.eventsCreated()])
      if (!rows.length) return null
      return rate(events.length, sum(rows.map((r) => r.replied)))
    },
  },
  {
    id: 'outbound.touchesPerMeeting',
    label: 'Touches per Booked Meeting',
    category: 'outbound',
    unit: 'number',
    description: 'Total outbound touches required to produce one booked meeting.',
    higherIsBetter: false,
    resolve: async (l) => {
      const [rows, events] = await Promise.all([l.outboundStats(), l.eventsCreated()])
      if (!rows.length || !events.length) return null
      return sum(rows.map((r) => r.sent + r.linkedinSent)) / events.length
    },
  },
  {
    id: 'outbound.inboxCount',
    label: 'Sending Inboxes Active',
    category: 'outbound',
    unit: 'number',
    description: 'Distinct inboxes that sent at least once in the period.',
    higherIsBetter: true,
    pointInTime: true,
    resolve: async (l) => {
      const rows = await l.outboundStats()
      if (!rows.length) return null
      const labels = new Set<string>()
      for (const r of rows) {
        const inboxes = r.byInbox as { label?: string; email?: string; sent?: number | null }[] | null
        if (!Array.isArray(inboxes)) continue
        for (const i of inboxes) {
          if ((i.sent ?? 0) > 0) labels.add(i.label ?? i.email ?? 'unknown')
        }
      }
      return labels.size || null
    },
  },
  {
    id: 'outbound.syncAgeHours',
    label: 'Outbound Sync Age',
    category: 'outbound',
    unit: 'hours',
    description:
      'Hours since the Lead Gen dashboard last pushed stats. A dead sync otherwise looks exactly like a quiet sales week.',
    higherIsBetter: false,
    pointInTime: true,
    resolve: async (l) => {
      const last = await l.lastOutboundSync()
      if (!last) return null
      return (Date.now() - new Date(last.syncedAt).getTime()) / 3_600_000
    },
  },
]
