-- Prevent double-booking: at most one active (non-cancelled) event may occupy a
-- given (calendarConfigId, startTime). Cancelled events are excluded so a slot
-- freed by a cancellation can be rebooked. This is the DB-level backstop for the
-- application's availability check, which alone cannot prevent a concurrent race.
--
-- Any pre-existing duplicate active bookings must be resolved before this index
-- can be created; the CONCURRENTLY-free form is used so it runs inside Prisma's
-- migration transaction.
CREATE UNIQUE INDEX "CalendarEvent_calendarConfigId_startTime_active_key"
  ON "CalendarEvent" ("calendarConfigId", "startTime")
  WHERE "status" <> 'CANCELLED';
