import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseRange, getGranularity, bucketKey, fillMultiTimeSeries } from '@/lib/metrics'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const range = parseRange(url.searchParams.get('from'), url.searchParams.get('to'))
  const gran = getGranularity(range)

  const [outboundMessages, calendarEvents, tasks, inboundMessages] = await Promise.all([
    prisma.message.findMany({
      where: { direction: 'OUTBOUND', createdAt: { gte: range.from, lte: range.to } },
      select: { channel: true, createdAt: true },
    }),
    prisma.calendarEvent.findMany({
      where: { createdAt: { gte: range.from, lte: range.to } },
      select: { status: true, createdAt: true, startTime: true },
    }),
    prisma.task.findMany({
      where: { createdAt: { gte: range.from, lte: range.to } },
      select: { status: true, createdAt: true, followUpTaskId: true },
    }),
    prisma.message.findMany({
      where: { direction: 'INBOUND', createdAt: { gte: range.from, lte: range.to } },
      select: { createdAt: true },
    }),
  ])

  const emailsSent = outboundMessages.filter((m) => m.channel === 'EMAIL').length
  const smsSent = outboundMessages.filter((m) => m.channel === 'SMS').length
  const meetingsBooked = calendarEvents.length
  const meetingsCompleted = calendarEvents.filter((e) => e.status === 'COMPLETED').length
  const noShows = calendarEvents.filter((e) => e.status === 'NO_SHOW').length
  const showRate = (meetingsCompleted + noShows) > 0 ? (meetingsCompleted / (meetingsCompleted + noShows)) * 100 : 0
  const demosDelivered = meetingsCompleted
  const followUpTasks = tasks.filter((t) => t.followUpTaskId !== null).length
  const followUpRate = tasks.length > 0 ? (followUpTasks / tasks.length) * 100 : 0

  // Response time: compare inbound message createdAt vs next outbound message to same contact
  // Approximation: median gap between inbound and outbound messages
  const responseTime: number | null = null // Requires per-contact correlation; return null

  // Multi time series: emails, sms, meetings, tasks
  type ActivityKey = 'emails' | 'sms' | 'meetings' | 'tasks'
  const activityData: Record<string, Partial<Record<ActivityKey, number>>> = {}

  for (const m of outboundMessages) {
    const key = bucketKey(new Date(m.createdAt), gran)
    if (!activityData[key]) activityData[key] = {}
    const field: ActivityKey = m.channel === 'EMAIL' ? 'emails' : 'sms'
    activityData[key][field] = (activityData[key][field] ?? 0) + 1
  }
  for (const e of calendarEvents) {
    const key = bucketKey(new Date(e.createdAt), gran)
    if (!activityData[key]) activityData[key] = {}
    activityData[key].meetings = (activityData[key].meetings ?? 0) + 1
  }
  for (const t of tasks) {
    const key = bucketKey(new Date(t.createdAt), gran)
    if (!activityData[key]) activityData[key] = {}
    activityData[key].tasks = (activityData[key].tasks ?? 0) + 1
  }

  const activityByType = fillMultiTimeSeries<ActivityKey>(range, gran, activityData, ['emails', 'sms', 'meetings', 'tasks'])

  // Daily activity heatmap — activity count per weekday × hour-of-day bucket
  // Returns {day: 0-6, period: 'AM'|'PM'|'Eve', count}
  const heatmap: Record<string, number> = { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0 }
  const allActivity = [
    ...outboundMessages.map((m) => m.createdAt),
    ...calendarEvents.map((e) => e.createdAt),
    ...tasks.map((t) => t.createdAt),
  ]
  for (const d of allActivity) {
    const day = new Date(d).getDay().toString()
    heatmap[day] = (heatmap[day] ?? 0) + 1
  }
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const activityByDay = dayNames.map((name, i) => ({ name, value: heatmap[i.toString()] ?? 0 }))

  return NextResponse.json({
    kpis: {
      emailsSent,
      smsSent,
      meetingsBooked,
      showRate,
      meetingsCompleted,
      demosDelivered,
      followUpRate,
      responseTime,
    },
    activityByType,
    activityByDay,
    granularity: gran,
  })
}
