import { prisma } from '@/lib/prisma'
import type { DateRange } from '@/lib/metrics'

/**
 * Per-request, per-window data loader for metric resolvers.
 *
 * Every accessor memoises its promise, so a view containing twelve revenue KPIs
 * that all read paid orders issues ONE query, not twelve. Resolvers never touch
 * prisma directly — they ask the loader, and batching falls out for free.
 *
 * One instance covers one window. The resolve endpoint builds two (current and
 * previous period) and runs the same resolver against each, which is why metric
 * definitions have no notion of "previous" themselves.
 */
export class MetricLoader {
  readonly range: DateRange
  private cache = new Map<string, Promise<unknown>>()

  constructor(range: DateRange) {
    this.range = range
  }

  private memo<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key)
    if (hit) return hit as Promise<T>
    const p = fn()
    this.cache.set(key, p)
    return p
  }

  private get window() {
    return { gte: this.range.from, lte: this.range.to }
  }

  // ─── Orders / revenue ──────────────────────────────────────────────────────

  paidOrders() {
    return this.memo('paidOrders', () =>
      prisma.order.findMany({
        where: { status: 'PAID', createdAt: this.window },
        include: { product: { select: { name: true, type: true, price: true } } },
      })
    )
  }

  allOrders() {
    return this.memo('allOrders', () =>
      prisma.order.findMany({
        where: { createdAt: this.window },
        select: { status: true, amount: true, createdAt: true },
      })
    )
  }

  // ─── Subscriptions ─────────────────────────────────────────────────────────

  activeSubs() {
    return this.memo('activeSubs', () =>
      prisma.subscription.findMany({
        where: { status: 'ACTIVE' },
        include: { product: { select: { price: true, interval: true } } },
      })
    )
  }

  subsCreated() {
    return this.memo('subsCreated', () =>
      prisma.subscription.findMany({
        where: { createdAt: this.window },
        include: { product: { select: { price: true, interval: true } } },
      })
    )
  }

  subsCancelled() {
    return this.memo('subsCancelled', () =>
      prisma.subscription.findMany({
        where: { cancelledAt: this.window },
        include: { product: { select: { price: true, interval: true } } },
      })
    )
  }

  subsBeforeWindow() {
    return this.memo('subsBeforeWindow', () =>
      prisma.subscription.count({ where: { createdAt: { lte: this.range.from } } })
    )
  }

  subsByStatus() {
    return this.memo('subsByStatus', () =>
      prisma.subscription.groupBy({ by: ['status'], _count: { _all: true } })
    )
  }

  // ─── Contacts ──────────────────────────────────────────────────────────────

  contacts() {
    return this.memo('contacts', () =>
      prisma.contact.findMany({
        where: { createdAt: this.window },
        select: { id: true, leadStatus: true, source: true, createdAt: true },
      })
    )
  }

  allContacts() {
    return this.memo('allContacts', () =>
      prisma.contact.findMany({
        select: {
          id: true,
          email: true,
          phone: true,
          companyId: true,
          doNotContact: true,
        },
      })
    )
  }

  // ─── Opportunities ─────────────────────────────────────────────────────────

  openOpps() {
    return this.memo('openOpps', () =>
      prisma.opportunity.findMany({
        where: { outcome: null, createdAt: { lte: this.range.to } },
        include: { stage: { select: { name: true, order: true } } },
      })
    )
  }

  oppsCreated() {
    return this.memo('oppsCreated', () =>
      prisma.opportunity.findMany({
        where: { createdAt: this.window },
        select: {
          id: true,
          createdAt: true,
          contactId: true,
          probability: true,
          value: true,
          outcome: true,
        },
      })
    )
  }

  closedOpps() {
    return this.memo('closedOpps', () =>
      prisma.opportunity.findMany({
        where: { outcome: { in: ['WON', 'LOST'] }, updatedAt: this.window },
        select: {
          outcome: true,
          value: true,
          wonAmount: true,
          outcomeReason: true,
          createdAt: true,
          updatedAt: true,
          contact: { select: { source: true } },
        },
      })
    )
  }

  allOppCount() {
    return this.memo('allOppCount', () => prisma.opportunity.count())
  }

  stages() {
    return this.memo('stages', () => prisma.stage.findMany({ orderBy: { order: 'asc' } }))
  }

  // ─── Calendar ──────────────────────────────────────────────────────────────

  /** Events by creation date — "meetings booked in this period". */
  eventsCreated() {
    return this.memo('eventsCreated', () =>
      prisma.calendarEvent.findMany({
        where: { createdAt: this.window },
        select: { status: true, createdAt: true, startTime: true, contactId: true },
      })
    )
  }

  /** Events by start date — "meetings that happened in this period". */
  eventsByStart() {
    return this.memo('eventsByStart', () =>
      prisma.calendarEvent.findMany({
        where: { startTime: this.window },
        select: { status: true, createdAt: true, startTime: true },
      })
    )
  }

  // ─── Messages ──────────────────────────────────────────────────────────────

  outboundMessages() {
    return this.memo('outboundMessages', () =>
      prisma.message.findMany({
        where: { direction: 'OUTBOUND', createdAt: this.window },
        select: { channel: true, createdAt: true, contactId: true },
      })
    )
  }

  inboundMessages() {
    return this.memo('inboundMessages', () =>
      prisma.message.findMany({
        where: { direction: 'INBOUND', createdAt: this.window },
        select: { channel: true, createdAt: true, contactId: true },
      })
    )
  }

  /** Newest message timestamp per contact — powers recency / silent-client checks. */
  lastMessagePerContact() {
    return this.memo('lastMessagePerContact', () =>
      prisma.message.groupBy({
        by: ['contactId'],
        _max: { createdAt: true },
      })
    )
  }

  // ─── Tasks ─────────────────────────────────────────────────────────────────

  tasksCreated() {
    return this.memo('tasksCreated', () =>
      prisma.task.findMany({
        where: { createdAt: this.window },
        select: { status: true, createdAt: true, followUpTaskId: true, dueDate: true },
      })
    )
  }

  openTasks() {
    return this.memo('openTasks', () =>
      prisma.task.findMany({
        where: { status: { in: ['TODO', 'IN_PROGRESS'] } },
        select: { dueDate: true, contactId: true, status: true },
      })
    )
  }

  // ─── Billing ───────────────────────────────────────────────────────────────

  invoices() {
    return this.memo('invoices', () =>
      prisma.invoice.findMany({
        where: { createdAt: this.window },
        select: { status: true, amount: true, sentAt: true, createdAt: true },
      })
    )
  }

  allOpenInvoices() {
    return this.memo('allOpenInvoices', () =>
      prisma.invoice.findMany({
        where: { status: { in: ['DRAFT', 'SENT'] } },
        select: { status: true, amount: true, sentAt: true, createdAt: true },
      })
    )
  }

  coupons() {
    return this.memo('coupons', () =>
      prisma.coupon.count({ where: { createdAt: this.window } })
    )
  }

  // ─── System health ─────────────────────────────────────────────────────────

  automationLogs() {
    return this.memo('automationLogs', () =>
      prisma.automationLog.groupBy({
        by: ['status'],
        where: { executedAt: this.window },
        _count: { _all: true },
      })
    )
  }

  automationQueue() {
    return this.memo('automationQueue', () =>
      prisma.automationQueue.findMany({
        where: { status: 'PENDING' },
        select: { createdAt: true, executeAt: true },
      })
    )
  }

  webhookLogs() {
    return this.memo('webhookLogs', () =>
      prisma.webhookLog.findMany({
        where: { createdAt: this.window },
        select: { success: true, statusCode: true, createdAt: true },
      })
    )
  }

  apiLogs() {
    return this.memo('apiLogs', () =>
      prisma.apiLog.findMany({
        where: { createdAt: this.window },
        select: { statusCode: true, createdAt: true },
      })
    )
  }

  activeApiKeys() {
    return this.memo('activeApiKeys', () =>
      prisma.apiKey.count({ where: { active: true } })
    )
  }

  unreadNotifications() {
    return this.memo('unreadNotifications', () =>
      prisma.notification.count({ where: { read: false } })
    )
  }

  // ─── Outbound (pushed in from the Lead Gen dashboard) ──────────────────────

  outboundStats() {
    return this.memo('outboundStats', () =>
      prisma.outboundDailyStat.findMany({
        where: { date: this.window },
        orderBy: { date: 'asc' },
      })
    )
  }

  /** Most recent sync of any day, used for the staleness check. */
  lastOutboundSync() {
    return this.memo('lastOutboundSync', () =>
      prisma.outboundDailyStat.findFirst({
        orderBy: { syncedAt: 'desc' },
        select: { syncedAt: true },
      })
    )
  }

  // ─── User-defined custom metrics ───────────────────────────────────────────
  // Both accessors load every custom metric's values at once and are memoised,
  // so a view holding ten custom metrics costs two queries, not twenty.

  /** All custom values inside the window, for SUM / AVERAGE / MAX / MIN. */
  customValuesInWindow() {
    return this.memo('customValuesInWindow', () =>
      prisma.customMetricValue.findMany({
        where: { date: this.window },
        select: { customMetricId: true, date: true, value: true },
        orderBy: { date: 'asc' },
      })
    )
  }

  /**
   * Most recent value at or before the end of the window, per metric.
   *
   * LATEST deliberately looks back beyond the window: a headcount or a running
   * balance recorded two months ago is still the current value, and reporting
   * "no data" for a quiet month would be wrong.
   */
  customValuesLatest() {
    return this.memo('customValuesLatest', () =>
      prisma.customMetricValue.findMany({
        where: { date: { lte: this.range.to } },
        select: { customMetricId: true, date: true, value: true },
        orderBy: { date: 'desc' },
        distinct: ['customMetricId'],
      })
    )
  }

  // ─── Manual targets ────────────────────────────────────────────────────────

  targets() {
    return this.memo('targets', () => prisma.metricTarget.findMany())
  }

  async target(metricId: string): Promise<number | null> {
    const all = await this.targets()
    return all.find((t) => t.metricId === metricId)?.value ?? null
  }
}
