import type { CalendarEvent } from "../../../../shared/calendar"

export type SidebarScheduleStatus =
  | { kind: "today-next"; event: CalendarEvent }
  | { kind: "today-done" }
  | { kind: "next-date"; event: CalendarEvent }
  | { kind: "none" }

export function eventStartTime(event: CalendarEvent) {
  if (!event.allDay) return Date.parse(event.start)
  const [year, month, day] = event.start.split("-").map(Number)
  return new Date(year, month - 1, day, 9).getTime()
}

function eventIntervalStart(event: CalendarEvent) {
  if (!event.allDay) return Date.parse(event.start)
  const [year, month, day] = event.start.split("-").map(Number)
  return new Date(year, month - 1, day).getTime()
}

export function eventEndTime(event: CalendarEvent) {
  if (!event.allDay) return Date.parse(event.end)
  const [year, month, day] = event.end.split("-").map(Number)
  return new Date(year, month - 1, day).getTime()
}

export function formatEventCountdown(event: CalendarEvent, now: number) {
  const minutes = Math.max(1, Math.ceil((eventStartTime(event) - now) / 60_000))
  const hours = Math.floor(minutes / 60)
  return hours ? `${hours}시간 ${minutes % 60}분` : `${minutes}분`
}

export function isEventOngoing(event: CalendarEvent, now: number) {
  return eventIntervalStart(event) <= now && eventEndTime(event) > now
}

export function nearestCalendarEvent(events: CalendarEvent[], now: number) {
  return (
    [...events]
      .filter((event) => eventStartTime(event) > now)
      .sort((a, b) => eventStartTime(a) - eventStartTime(b))[0] ?? null
  )
}

export function sidebarScheduleStatus(
  events: CalendarEvent[],
  now: number
): SidebarScheduleStatus {
  const date = new Date(now)
  const todayStart = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ).getTime()
  const tomorrow = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 1
  ).getTime()
  const todayEvents = events.filter(
    (event) =>
      eventEndTime(event) > todayStart && eventIntervalStart(event) < tomorrow
  )
  const todayUpcoming = todayEvents
    .filter((event) => eventStartTime(event) > now)
    .sort((a, b) => eventStartTime(a) - eventStartTime(b))[0]
  if (todayUpcoming) return { kind: "today-next", event: todayUpcoming }
  if (todayEvents.some((event) => isEventOngoing(event, now))) {
    return { kind: "today-done" }
  }
  const next = nearestCalendarEvent(events, now)
  return next ? { kind: "next-date", event: next } : { kind: "none" }
}
