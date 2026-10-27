import type { CalendarEvent } from "../../../../shared/calendar"
import {
  CalendarDaysIcon,
  CalendarOffIcon,
  CheckIcon,
  Clock3Icon,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { eventStartTime, formatEventCountdown } from "./schedule-status"
import type { SidebarScheduleStatus } from "./schedule-status"

export function ScheduleStatusCard({
  status,
  now,
}: {
  status: SidebarScheduleStatus
  now: number
}) {
  const event = "event" in status ? status.event : null
  const remaining =
    status.kind === "today-next" ? eventStartTime(status.event) - now : null
  const urgent = remaining !== null && remaining <= 5 * 60_000
  const startingSoon = remaining !== null && remaining <= 60_000
  const Icon =
    status.kind === "today-next"
      ? Clock3Icon
      : status.kind === "today-done"
        ? CheckIcon
        : status.kind === "next-date"
          ? CalendarDaysIcon
          : CalendarOffIcon
  const label =
    status.kind === "today-next" || status.kind === "next-date"
      ? "다음 일정"
      : "일정 현황"
  const summary =
    status.kind === "today-next"
      ? startingSoon
        ? "곧 시작"
        : `${formatEventCountdown(status.event, now)} 후`
      : status.kind === "today-done"
        ? "오늘 남은 일정 없음"
        : status.kind === "next-date"
          ? formatSidebarDate(status.event, now)
          : "예정된 일정 없음"

  // Data is supplied by the caller so the same card works in the app and Storybook.
  return (
    <Card
      size="sm"
      aria-label="일정 현황"
      className="h-[70px] shrink-0 justify-center rounded-lg border-0 py-0 shadow-none ring-0"
    >
      <CardContent>
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${urgent ? "bg-orange-500/10 text-orange-600 dark:text-orange-400" : event ? "bg-primary/10 text-primary" : status.kind === "today-done" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}
          >
            <Icon className="size-4" />
          </span>
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p
              className={`text-sm leading-snug font-semibold tabular-nums ${urgent ? "text-orange-600 dark:text-orange-400" : "text-foreground"}`}
            >
              {summary}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function formatSidebarDate(event: CalendarEvent, now: number) {
  const start = event.allDay
    ? (() => {
        const [year, month, day] = event.start.split("-").map(Number)
        return new Date(year, month - 1, day, 9)
      })()
    : new Date(event.start)
  const today = new Date(now)
  const tomorrow = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 1
  )
  const isTomorrow =
    start.getFullYear() === tomorrow.getFullYear() &&
    start.getMonth() === tomorrow.getMonth() &&
    start.getDate() === tomorrow.getDate()
  const time = formatEventTime(event)
  return isTomorrow
    ? `내일 ${time}`
    : `${start.getMonth() + 1}월 ${start.getDate()}일 ${time}`
}

function formatEventTime(event: CalendarEvent) {
  if (event.allDay) return "09:00"
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(event.start))
}
