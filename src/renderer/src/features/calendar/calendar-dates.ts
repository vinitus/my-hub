import {
  CalendarEventSchema,
  type CalendarEvent,
} from "../../../../shared/calendar"

export type EventDraft = {
  id: string
  title: string
  description: string
  color: CalendarEvent["color"]
  referenceUrls: string[]
  openLinks: CalendarEvent["openLinks"]
  notifyOS: boolean
  notifyInApp: boolean
  allDay: boolean
  startDate: string
  endDate: string
  startTime: string
  endTime: string
}

export function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`)
  if (
    !Number.isFinite(value.getTime()) ||
    value.toISOString().slice(0, 10) !== date
  )
    throw new Error("날짜를 확인해 주세요.")
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}
export function localDate(date: Date) {
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}
function localTime(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}

export function eventDraft(event: CalendarEvent): EventDraft {
  return {
    ...event,
    startDate: event.allDay ? event.start : localDate(new Date(event.start)),
    endDate: event.allDay
      ? shiftDate(event.end, -1)
      : localDate(new Date(event.end)),
    startTime: event.allDay ? "09:00" : localTime(new Date(event.start)),
    endTime: event.allDay ? "10:00" : localTime(new Date(event.end)),
  }
}

export function eventFromDraft(
  draft: EventDraft,
  original?: CalendarEvent
): CalendarEvent {
  function timed(date: string, time: string, previous?: string) {
    if (previous) {
      const value = new Date(previous)
      if (localDate(value) === date && localTime(value) === time)
        return previous
    }
    const value = new Date(`${date}T${time}:00`)
    if (
      !Number.isFinite(value.getTime()) ||
      localDate(value) !== date ||
      localTime(value) !== time
    )
      throw new Error("날짜와 시간을 확인해 주세요.")
    return value.toISOString()
  }
  const start = draft.allDay
    ? draft.startDate
    : timed(
        draft.startDate,
        draft.startTime,
        original && !original.allDay ? original.start : undefined
      )
  const end = draft.allDay
    ? shiftDate(draft.endDate, 1)
    : timed(
        draft.endDate,
        draft.endTime,
        original && !original.allDay ? original.end : undefined
      )
  const result = CalendarEventSchema.safeParse({
    id: draft.id,
    title: draft.title,
    description: draft.description,
    color: draft.color,
    referenceUrls: draft.referenceUrls.filter((url) => url.trim()),
    openLinks: draft.openLinks,
    notifyOS: draft.notifyOS,
    notifyInApp: draft.notifyInApp,
    allDay: draft.allDay,
    start,
    end,
  })
  if (!result.success)
    throw new Error(
      result.error.issues[0]?.message ?? "일정 내용을 확인해 주세요."
    )
  return result.data
}

export function newCalendarEvent(
  date = new Date(),
  allDay = false,
  end?: string
): CalendarEvent {
  return {
    id: crypto.randomUUID(),
    title: "",
    description: "",
    color: "blue",
    referenceUrls: [],
    openLinks: "never",
    notifyOS: true,
    notifyInApp: true,
    allDay,
    start: allDay ? localDate(date) : date.toISOString(),
    end:
      end ??
      (allDay
        ? shiftDate(localDate(date), 1)
        : new Date(date.getTime() + 3600000).toISOString()),
  }
}
