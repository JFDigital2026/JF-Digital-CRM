/**
 * Timezone helpers for calendar booking.
 *
 * Availability windows ("09:00"–"17:00") are wall-clock times in the calendar's
 * configured IANA timezone (config.timezone). Previously the booking/availability
 * code anchored slots to UTC midnight and stored events in server-local time, so
 * a calendar set to America/New_York actually offered 09:00–17:00 *UTC* and the
 * stored instant only matched the conflict query when the server happened to run
 * in UTC. These helpers make every path interpret slots in config.timezone.
 */

// Offset (ms) between the given IANA timezone's wall clock and UTC at `utcDate`,
// i.e. offset = localWallClock - utc. Positive east of UTC. Uses Intl so it
// respects DST for the specific instant. No external dependency.
function tzOffsetMs(timeZone: string, utcDate: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const map: Record<string, string> = {}
  for (const p of dtf.formatToParts(utcDate)) {
    if (p.type !== 'literal') map[p.type] = p.value
  }
  let hour = Number(map.hour)
  if (hour === 24) hour = 0 // some engines render midnight as 24
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second)
  )
  return asUtc - utcDate.getTime()
}

/**
 * Convert a wall-clock date (YYYY-MM-DD) + time (HH:MM) interpreted in `timeZone`
 * to the corresponding absolute UTC Date. Falls back to a naive parse if the
 * timezone is missing/invalid so callers never crash on bad config.
 */
export function zonedWallTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = timeStr.split(':').map(Number)
  if ([y, m, d, hh, mm].some((n) => Number.isNaN(n))) {
    return new Date(NaN)
  }
  const guessUtc = Date.UTC(y, m - 1, d, hh, mm, 0, 0)
  try {
    const offset = tzOffsetMs(timeZone, new Date(guessUtc))
    return new Date(guessUtc - offset)
  } catch {
    return new Date(guessUtc)
  }
}
