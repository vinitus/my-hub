import {
  eventStartTime,
  isEventOngoing,
} from "../../../entities/calendar-event"
import type { CalendarEvent } from "../../../../../shared/calendar"

// 알림과 동일하게 종일 일정의 실행 기준은 로컬 오전 9시를 사용한다.
export function panelSchedule(events: CalendarEvent[], now: number) {
  const date = new Date(now)
  const tomorrow = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 1
  ).getTime()
  const upcoming = events
    .filter((event) => eventStartTime(event) > now)
    .sort((a, b) => eventStartTime(a) - eventStartTime(b))
  return {
    today: upcoming.filter(
      (event) => eventStartTime(event) < tomorrow && !isEventOngoing(event, now)
    ),
    executions: upcoming.filter(
      (event) => event.openLinks !== "never" && event.referenceUrls.length > 0
    ),
  }
}
