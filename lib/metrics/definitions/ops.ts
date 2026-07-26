import { prisma } from '@/lib/prisma'
import type { MetricDefinition } from '@/lib/metrics/types'
import { rate, mean, sum, countSeries, daysBetween } from '@/lib/metrics/util'

// ─── Leads & list quality ────────────────────────────────────────────────────
// Scoring, tiering and verification live in the Lead Gen dashboard and are not
// part of the outbound stats payload (which carries aggregate email counts only).
// Those entries are registered as unavailable rather than omitted, so they are
// visible in the picker with an honest reason.

export const leadMetrics: MetricDefinition[] = [
  {
    id: 'leads.newContacts',
    label: 'New Contacts',
    category: 'leads',
    unit: 'number',
    description: 'Contacts created in the CRM during the period.',
    higherIsBetter: true,
    resolve: async (l) => (await l.contacts()).length,
    series: async (l, ctx) =>
      countSeries((await l.contacts()).map((c) => ({ date: c.createdAt })), ctx),
  },
  {
    id: 'leads.newCompanies',
    label: 'New Companies',
    category: 'leads',
    unit: 'number',
    description: 'Companies created in the period — for outbound, one per firm.',
    higherIsBetter: true,
    resolve: async (l) =>
      prisma.company.count({ where: { createdAt: { gte: l.range.from, lte: l.range.to } } }),
  },
  {
    id: 'leads.sourcedFromOutbound',
    label: 'Leads from Outbound',
    category: 'leads',
    unit: 'number',
    description: 'Contacts whose recorded source is outbound or cold email.',
    higherIsBetter: true,
    resolve: async (l) =>
      (await l.contacts()).filter((c) => {
        const s = (c.source ?? '').toLowerCase()
        return s.includes('outbound') || s.includes('cold') || s.includes('lead gen')
      }).length,
  },
  {
    id: 'leads.sourceCoverage',
    label: 'Source Coverage',
    category: 'leads',
    unit: 'percent',
    description:
      'Share of new contacts with an acquisition source recorded. Low coverage makes every channel comparison meaningless.',
    higherIsBetter: true,
    resolve: async (l) => {
      const contacts = await l.contacts()
      return rate(contacts.filter((c) => !!c.source).length, contacts.length)
    },
  },
  {
    id: 'leads.dataCompleteness',
    label: 'Contact Data Completeness',
    category: 'leads',
    unit: 'percent',
    description: 'Share of all contacts that have an email, a phone and a linked company.',
    higherIsBetter: true,
    pointInTime: true,
    resolve: async (l) => {
      const contacts = await l.allContacts()
      const complete = contacts.filter((c) => c.email && c.phone && c.companyId).length
      return rate(complete, contacts.length)
    },
  },
  {
    id: 'leads.emailCoverage',
    label: 'Email Coverage',
    category: 'leads',
    unit: 'percent',
    description: 'Share of contacts with an email address on file.',
    higherIsBetter: true,
    pointInTime: true,
    resolve: async (l) => {
      const contacts = await l.allContacts()
      return rate(contacts.filter((c) => !!c.email).length, contacts.length)
    },
  },
  {
    id: 'leads.doNotContactShare',
    label: 'Do-Not-Contact Share',
    category: 'leads',
    unit: 'percent',
    description: 'Share of the contact base flagged do-not-contact.',
    higherIsBetter: false,
    pointInTime: true,
    resolve: async (l) => {
      const contacts = await l.allContacts()
      return rate(contacts.filter((c) => c.doNotContact).length, contacts.length)
    },
  },
  {
    id: 'leads.contactableBase',
    label: 'Contactable Base',
    category: 'leads',
    unit: 'number',
    description: 'Contacts with an email and no do-not-contact flag.',
    higherIsBetter: true,
    pointInTime: true,
    resolve: async (l) =>
      (await l.allContacts()).filter((c) => c.email && !c.doNotContact).length,
  },
  {
    id: 'leads.tierMix',
    label: 'HOT Tier Share',
    category: 'leads',
    unit: 'percent',
    description: 'Share of sourced leads scoring HOT in the Lead Gen scoring model.',
    higherIsBetter: true,
    unavailable: 'needs-lead-gen-field',
  },
  {
    id: 'leads.avgProspectScore',
    label: 'Average Prospect Score',
    category: 'leads',
    unit: 'score',
    description: 'Mean Lead Gen prospect score out of 27.',
    higherIsBetter: true,
    unavailable: 'needs-lead-gen-field',
  },
  {
    id: 'leads.verificationPassRate',
    label: 'Verification Pass Rate',
    category: 'leads',
    unit: 'percent',
    description: 'Share of candidates surviving the Tier B verification stage.',
    higherIsBetter: true,
    unavailable: 'needs-lead-gen-field',
  },
  {
    id: 'leads.precheckKillRate',
    label: 'Precheck Kill Rate',
    category: 'leads',
    unit: 'percent',
    description: 'Share of candidates killed by machine precheck before any AI spend.',
    higherIsBetter: true,
    unavailable: 'needs-lead-gen-field',
  },
  {
    id: 'leads.genericEmailShare',
    label: 'Generic Email Share',
    category: 'leads',
    unit: 'percent',
    description: 'Share of the list on info@ or contact@ addresses rather than a person.',
    higherIsBetter: false,
    unavailable: 'needs-lead-gen-field',
  },
  {
    id: 'leads.costPerLead',
    label: 'Cost per Lead',
    category: 'leads',
    unit: 'currency',
    description: 'Data API spend divided by leads sourced.',
    higherIsBetter: false,
    unavailable: 'needs-manual-entry',
  },
]

// ─── Delivery / Recovery Blueprint ───────────────────────────────────────────
// Map → Diagnose → Build → Evolve. The CRM has no delivery stage model, so most
// of this block waits on one. Audits are inferred from calendar events, which is
// the one part that works today.

export const deliveryMetrics: MetricDefinition[] = [
  {
    id: 'delivery.auditsBooked',
    label: 'Audits Booked',
    category: 'delivery',
    unit: 'number',
    description: 'Discovery and audit calls scheduled in the period.',
    higherIsBetter: true,
    resolve: async (l) => (await l.eventsCreated()).length,
    series: async (l, ctx) =>
      countSeries((await l.eventsCreated()).map((e) => ({ date: e.createdAt })), ctx),
  },
  {
    id: 'delivery.auditsCompleted',
    label: 'Audits Completed',
    category: 'delivery',
    unit: 'number',
    description: 'Audit calls that actually took place.',
    higherIsBetter: true,
    resolve: async (l) =>
      (await l.eventsByStart()).filter((e) => e.status === 'COMPLETED').length,
  },
  {
    id: 'delivery.auditToProposalRate',
    label: 'Audit → Proposal Rate',
    category: 'delivery',
    unit: 'percent',
    description: 'Completed audits that produced an opportunity.',
    higherIsBetter: true,
    resolve: async (l) => {
      const [events, opps] = await Promise.all([l.eventsByStart(), l.oppsCreated()])
      const completed = events.filter((e) => e.status === 'COMPLETED').length
      return rate(opps.length, completed)
    },
  },
  {
    id: 'delivery.openClientTasks',
    label: 'Open Client Tasks',
    category: 'delivery',
    unit: 'number',
    description: 'Open tasks attached to a contact — a proxy for live delivery work.',
    higherIsBetter: false,
    pointInTime: true,
    resolve: async (l) => (await l.openTasks()).filter((t) => t.contactId).length,
  },
  {
    id: 'delivery.overdueTaskRate',
    label: 'Overdue Task Rate',
    category: 'delivery',
    unit: 'percent',
    description: 'Share of open tasks past their due date.',
    higherIsBetter: false,
    pointInTime: true,
    resolve: async (l) => {
      const tasks = await l.openTasks()
      const now = new Date()
      const overdue = tasks.filter((t) => t.dueDate && new Date(t.dueDate) < now).length
      return rate(overdue, tasks.length)
    },
  },
  {
    id: 'delivery.mapStageTime',
    label: 'Map Stage Completion Time',
    category: 'delivery',
    unit: 'days',
    description: 'Days to finish documenting a firm’s manual processes.',
    higherIsBetter: false,
    unavailable: 'needs-delivery-tracking',
  },
  {
    id: 'delivery.diagnoseToBuild',
    label: 'Diagnose → Build Handoff',
    category: 'delivery',
    unit: 'days',
    description: 'Days from bottleneck identified to build kickoff.',
    higherIsBetter: false,
    unavailable: 'needs-delivery-tracking',
  },
  {
    id: 'delivery.buildDeliveryTime',
    label: 'Build Delivery Time',
    category: 'delivery',
    unit: 'days',
    description: 'Days from kickoff to the system going live.',
    higherIsBetter: false,
    unavailable: 'needs-delivery-tracking',
  },
  {
    id: 'delivery.timeToFirstValue',
    label: 'Time to First Value',
    category: 'delivery',
    unit: 'days',
    description: 'Days from contract signed to the client’s first saved hour.',
    higherIsBetter: false,
    unavailable: 'needs-delivery-tracking',
  },
  {
    id: 'delivery.activeBuilds',
    label: 'Active Builds',
    category: 'delivery',
    unit: 'number',
    description: 'Clients currently in the Build stage.',
    higherIsBetter: true,
    unavailable: 'needs-delivery-tracking',
  },
  {
    id: 'delivery.clientsInEvolve',
    label: 'Clients in Evolve',
    category: 'delivery',
    unit: 'number',
    description: 'Clients on the maintenance and upgrade cadence.',
    higherIsBetter: true,
    unavailable: 'needs-delivery-tracking',
  },
  {
    id: 'delivery.onTimeDeliveryRate',
    label: 'On-Time Delivery Rate',
    category: 'delivery',
    unit: 'percent',
    description: 'Builds shipped by the promised date.',
    higherIsBetter: true,
    unavailable: 'needs-delivery-tracking',
  },
  {
    id: 'delivery.capacityUtilization',
    label: 'Delivery Capacity Utilization',
    category: 'delivery',
    unit: 'percent',
    description: 'Active builds against the maximum concurrent build ceiling.',
    higherIsBetter: true,
    unavailable: 'needs-delivery-tracking',
  },
]

// ─── Admin & cash ────────────────────────────────────────────────────────────

export const adminMetrics: MetricDefinition[] = [
  {
    id: 'admin.outstandingInvoiceValue',
    label: 'Outstanding Invoice Value',
    category: 'admin',
    unit: 'currency',
    description: 'Value of invoices issued but not yet paid.',
    higherIsBetter: false,
    pointInTime: true,
    resolve: async (l) => sum((await l.allOpenInvoices()).map((i) => i.amount)),
  },
  {
    id: 'admin.outstandingInvoiceCount',
    label: 'Outstanding Invoices',
    category: 'admin',
    unit: 'number',
    description: 'Count of unpaid invoices.',
    higherIsBetter: false,
    pointInTime: true,
    resolve: async (l) => (await l.allOpenInvoices()).length,
  },
  {
    id: 'admin.collectionRate',
    label: 'Collection Rate',
    category: 'admin',
    unit: 'percent',
    description: 'Invoiced value in the period that has been paid.',
    higherIsBetter: true,
    resolve: async (l) => {
      const invoices = await l.invoices()
      const total = sum(invoices.map((i) => i.amount))
      if (!total) return null
      return (sum(invoices.filter((i) => i.status === 'PAID').map((i) => i.amount)) / total) * 100
    },
  },
  {
    id: 'admin.avgInvoiceValue',
    label: 'Average Invoice Value',
    category: 'admin',
    unit: 'currency',
    description: 'Mean invoice amount in the period.',
    higherIsBetter: true,
    resolve: async (l) => mean((await l.invoices()).map((i) => i.amount)),
  },
  {
    id: 'admin.invoiceAgeDays',
    label: 'Average Unpaid Invoice Age',
    category: 'admin',
    unit: 'days',
    description:
      'Mean days since issue across unpaid invoices — the closest thing to DSO available without payment timestamps.',
    higherIsBetter: false,
    pointInTime: true,
    resolve: async (l) => {
      const open = await l.allOpenInvoices()
      const now = new Date()
      return mean(open.map((i) => daysBetween(i.sentAt ?? i.createdAt, now)))
    },
  },
  {
    id: 'admin.failedOrders',
    label: 'Failed Orders',
    category: 'admin',
    unit: 'number',
    description: 'Orders that failed payment in the period.',
    higherIsBetter: false,
    resolve: async (l) => (await l.allOrders()).filter((o) => o.status === 'FAILED').length,
  },
  {
    id: 'admin.refundedOrders',
    label: 'Refunded Orders',
    category: 'admin',
    unit: 'number',
    description: 'Orders refunded in the period.',
    higherIsBetter: false,
    resolve: async (l) => (await l.allOrders()).filter((o) => o.status === 'REFUNDED').length,
  },
  {
    id: 'admin.orderFailureRate',
    label: 'Order Failure Rate',
    category: 'admin',
    unit: 'percent',
    description: 'Failed orders as a share of all orders placed.',
    higherIsBetter: false,
    resolve: async (l) => {
      const orders = await l.allOrders()
      return rate(orders.filter((o) => o.status === 'FAILED').length, orders.length)
    },
  },
  {
    id: 'admin.couponsIssued',
    label: 'Coupons Issued',
    category: 'admin',
    unit: 'number',
    description: 'Coupons created in the period.',
    higherIsBetter: false,
    resolve: async (l) => l.coupons(),
  },
  {
    id: 'admin.openTasks',
    label: 'Open Tasks',
    category: 'admin',
    unit: 'number',
    description: 'All tasks not yet complete.',
    higherIsBetter: false,
    pointInTime: true,
    resolve: async (l) => (await l.openTasks()).length,
  },
  {
    id: 'admin.overdueTasks',
    label: 'Overdue Tasks',
    category: 'admin',
    unit: 'number',
    description: 'Open tasks past their due date.',
    higherIsBetter: false,
    pointInTime: true,
    resolve: async (l) => {
      const now = new Date()
      return (await l.openTasks()).filter((t) => t.dueDate && new Date(t.dueDate) < now).length
    },
  },
  {
    id: 'admin.notificationBacklog',
    label: 'Notification Backlog',
    category: 'admin',
    unit: 'number',
    description: 'Unread notifications across the workspace.',
    higherIsBetter: false,
    pointInTime: true,
    resolve: async (l) => l.unreadNotifications(),
  },
]

// ─── System & automation health ──────────────────────────────────────────────
// For an automation agency, an automation failing silently is an existential
// embarrassment. All of this is cheap to compute from logs already being written.

export const systemMetrics: MetricDefinition[] = [
  {
    id: 'system.automationSuccessRate',
    label: 'Automation Success Rate',
    category: 'system',
    unit: 'percent',
    description: 'Successful automation runs as a share of all runs in the period.',
    higherIsBetter: true,
    resolve: async (l) => {
      const groups = await l.automationLogs()
      const total = sum(groups.map((g) => g._count._all))
      const success = groups.find((g) => g.status === 'SUCCESS')?._count._all ?? 0
      return rate(success, total)
    },
  },
  {
    id: 'system.automationFailures',
    label: 'Automation Failures',
    category: 'system',
    unit: 'number',
    description: 'Automation runs that failed in the period.',
    higherIsBetter: false,
    resolve: async (l) => {
      const groups = await l.automationLogs()
      return groups.find((g) => g.status === 'FAILURE')?._count._all ?? 0
    },
  },
  {
    id: 'system.automationRuns',
    label: 'Automation Runs',
    category: 'system',
    unit: 'number',
    description: 'Total automation executions in the period.',
    higherIsBetter: true,
    resolve: async (l) => sum((await l.automationLogs()).map((g) => g._count._all)),
  },
  {
    id: 'system.queueDepth',
    label: 'Automation Queue Depth',
    category: 'system',
    unit: 'number',
    description: 'Queue items still pending execution.',
    higherIsBetter: false,
    pointInTime: true,
    resolve: async (l) => (await l.automationQueue()).length,
  },
  {
    id: 'system.oldestQueueItemHours',
    label: 'Oldest Queue Item',
    category: 'system',
    unit: 'hours',
    description:
      'Age of the oldest pending queue item. Rising here means the queue processor is stuck.',
    higherIsBetter: false,
    pointInTime: true,
    resolve: async (l) => {
      const queue = await l.automationQueue()
      if (!queue.length) return null
      const oldest = Math.min(...queue.map((q) => new Date(q.createdAt).getTime()))
      return (Date.now() - oldest) / 3_600_000
    },
  },
  {
    id: 'system.webhookSuccessRate',
    label: 'Webhook Delivery Rate',
    category: 'system',
    unit: 'percent',
    description: 'Successful outbound webhook deliveries as a share of attempts.',
    higherIsBetter: true,
    resolve: async (l) => {
      const logs = await l.webhookLogs()
      return rate(logs.filter((w) => w.success).length, logs.length)
    },
  },
  {
    id: 'system.webhookFailures',
    label: 'Webhook Failures',
    category: 'system',
    unit: 'number',
    description: 'Failed webhook deliveries in the period.',
    higherIsBetter: false,
    resolve: async (l) => (await l.webhookLogs()).filter((w) => !w.success).length,
  },
  {
    id: 'system.apiRequests',
    label: 'API Requests',
    category: 'system',
    unit: 'number',
    description: 'Calls to the versioned public API in the period.',
    higherIsBetter: true,
    resolve: async (l) => (await l.apiLogs()).length,
    series: async (l, ctx) =>
      countSeries((await l.apiLogs()).map((a) => ({ date: a.createdAt })), ctx),
  },
  {
    id: 'system.apiErrorRate',
    label: 'API Error Rate',
    category: 'system',
    unit: 'percent',
    description: 'Non-2xx responses as a share of all API requests.',
    higherIsBetter: false,
    resolve: async (l) => {
      const logs = await l.apiLogs()
      return rate(logs.filter((a) => a.statusCode >= 400).length, logs.length)
    },
  },
  {
    id: 'system.activeApiKeys',
    label: 'Active API Keys',
    category: 'system',
    unit: 'number',
    description: 'API keys currently enabled.',
    higherIsBetter: true,
    pointInTime: true,
    resolve: async (l) => l.activeApiKeys(),
  },
  {
    id: 'system.outboundSyncFresh',
    label: 'Outbound Sync Healthy',
    category: 'system',
    unit: 'percent',
    description:
      'One hundred when the Lead Gen push arrived within the last 24 hours, zero when it did not.',
    higherIsBetter: true,
    pointInTime: true,
    resolve: async (l) => {
      const last = await l.lastOutboundSync()
      if (!last) return null
      const hours = (Date.now() - new Date(last.syncedAt).getTime()) / 3_600_000
      return hours <= 24 ? 100 : 0
    },
  },
]

// ─── Marketing & inbound ─────────────────────────────────────────────────────

export const marketingMetrics: MetricDefinition[] = [
  {
    id: 'marketing.inboundMessages',
    label: 'Inbound DMs Received',
    category: 'marketing',
    unit: 'number',
    description: 'Contact-initiated messages across all channels.',
    higherIsBetter: true,
    resolve: async (l) => (await l.inboundMessages()).length,
    series: async (l, ctx) =>
      countSeries((await l.inboundMessages()).map((m) => ({ date: m.createdAt })), ctx),
  },
  {
    id: 'marketing.socialInbound',
    label: 'Social Inbound',
    category: 'marketing',
    unit: 'number',
    description: 'Inbound messages arriving via Instagram, Facebook or LinkedIn.',
    higherIsBetter: true,
    resolve: async (l) =>
      (await l.inboundMessages()).filter((m) =>
        ['INSTAGRAM', 'FACEBOOK', 'LINKEDIN'].includes(m.channel)
      ).length,
  },
  {
    id: 'marketing.inboundToCallRate',
    label: 'Inbound → Call Rate',
    category: 'marketing',
    unit: 'percent',
    description: 'Meetings booked as a share of inbound conversations started.',
    higherIsBetter: true,
    resolve: async (l) => {
      const [inbound, events] = await Promise.all([l.inboundMessages(), l.eventsCreated()])
      const distinct = new Set(inbound.map((m) => m.contactId).filter(Boolean)).size
      return rate(events.length, distinct)
    },
  },
  {
    id: 'marketing.bookingsFromCalendar',
    label: 'Self-Serve Bookings',
    category: 'marketing',
    unit: 'number',
    description: 'Meetings booked through the public booking page rather than created manually.',
    higherIsBetter: true,
    resolve: async (l) => (await l.eventsCreated()).filter((e) => e.contactId).length,
  },
  {
    id: 'marketing.referralContacts',
    label: 'Referral Contacts',
    category: 'marketing',
    unit: 'number',
    description: 'New contacts whose source is recorded as a referral.',
    higherIsBetter: true,
    resolve: async (l) =>
      (await l.contacts()).filter((c) => (c.source ?? '').toLowerCase().includes('referral'))
        .length,
  },
  {
    id: 'marketing.channelCount',
    label: 'Active Acquisition Channels',
    category: 'marketing',
    unit: 'number',
    description: 'Distinct sources producing at least one contact in the period.',
    higherIsBetter: true,
    resolve: async (l) =>
      new Set((await l.contacts()).map((c) => c.source).filter(Boolean)).size,
  },
  {
    id: 'marketing.contentPublished',
    label: 'Content Pieces Published',
    category: 'marketing',
    unit: 'number',
    description: 'Short-form videos and posts shipped in the period.',
    higherIsBetter: true,
    unavailable: 'needs-manual-entry',
  },
  {
    id: 'marketing.costPerAcquisition',
    label: 'Cost per Acquisition',
    category: 'marketing',
    unit: 'currency',
    description: 'Total marketing spend divided by clients won.',
    higherIsBetter: false,
    unavailable: 'needs-manual-entry',
  },
]
