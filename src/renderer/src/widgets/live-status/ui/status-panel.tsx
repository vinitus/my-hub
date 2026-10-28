import { useId } from "react"
import {
  CalendarDaysIcon,
  ExternalLinkIcon,
  FolderIcon,
  GlobeIcon,
  MonitorIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
} from "lucide-react"
import { Button } from "@/shared/ui/button"
import type { CalendarEvent } from "../../../../../shared/calendar"
import type { Shortcut } from "../../../../../shared/shortcuts"
import { panelSchedule } from "../model/panel-status"

export type StatusPanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  events: CalendarEvent[]
  shortcuts: Shortcut[]
  now: number
  calendarLoading?: boolean
  calendarError?: string
  shortcutsLoading?: boolean
  shortcutsError?: string
  shortcutsBusy?: boolean
  onLaunch: (item: Shortcut) => void
  onOpenCalendar: () => void
  onOpenShortcuts: () => void
}

function eventTime(event: CalendarEvent, now: number) {
  if (event.allDay) return `${event.start.slice(5).replace("-", "/")} · 09:00`
  const start = new Date(event.start)
  const today = new Date(now)
  const isToday = start.toDateString() === today.toDateString()
  return new Intl.DateTimeFormat("ko-KR", {
    ...(isToday ? {} : { month: "numeric", day: "numeric" }),
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(start)
}

export function StatusPanel({
  open,
  onOpenChange,
  events,
  shortcuts,
  now,
  calendarLoading = false,
  calendarError = "",
  shortcutsLoading = false,
  shortcutsError = "",
  shortcutsBusy = false,
  onLaunch,
  onOpenCalendar,
  onOpenShortcuts,
}: StatusPanelProps) {
  const contentId = useId()
  const { today, executions } = panelSchedule(events, now)
  const calendarMessage =
    calendarError || (calendarLoading ? "일정 불러오는 중…" : "")
  return (
    <aside
      aria-label="실시간 현황"
      className={`${open ? "absolute inset-y-0 right-0 z-20 w-[280px] max-w-full shadow-lg lg:static lg:shadow-none" : "w-10"} flex min-h-0 shrink-0 flex-col border-l bg-background`}
    >
      <div
        className={`flex h-11 shrink-0 items-center ${open ? "justify-between px-3" : "justify-center"}`}
      >
        {open && <h2 className="text-sm font-semibold">실시간 현황</h2>}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={open ? "현황 패널 접기" : "현황 패널 펼치기"}
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => onOpenChange(!open)}
        >
          {open ? <PanelRightCloseIcon /> : <PanelRightOpenIcon />}
        </Button>
      </div>
      <div
        id={contentId}
        hidden={!open}
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-4"
      >
        <section aria-label="오늘의 일정" className="border-t py-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-xs font-medium">
              <CalendarDaysIcon className="size-3.5" />
              오늘의 일정{" "}
              <span className="text-muted-foreground">{today.length}</span>
            </h3>
            <Button variant="ghost" size="xs" onClick={onOpenCalendar}>
              전체 보기
            </Button>
          </div>
          {calendarMessage ? (
            <p
              role={calendarError ? "alert" : "status"}
              className="text-xs text-muted-foreground"
            >
              {calendarMessage}
            </p>
          ) : today.length ? (
            <ul className="space-y-3">
              {today.map((event) => (
                <li key={event.id} className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    {eventTime(event, now)}
                  </p>
                  <p className="mt-0.5 truncate text-sm" title={event.title}>
                    {event.title}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              오늘 남은 일정이 없습니다.
            </p>
          )}
        </section>
        <section aria-label="예정된 실행" className="border-t py-4">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-medium">
            <ExternalLinkIcon className="size-3.5" />
            예정된 실행{" "}
            <span className="text-muted-foreground">
              {executions.reduce(
                (count, event) => count + event.referenceUrls.length,
                0
              )}
            </span>
          </h3>
          {calendarMessage ? (
            <p className="text-xs text-muted-foreground">{calendarMessage}</p>
          ) : executions.length ? (
            <ul className="space-y-4">
              {executions.map((event) => (
                <li key={event.id} className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    {eventTime(event, now)} ·{" "}
                    {event.openLinks === "at-start"
                      ? "시작 시 자동 실행"
                      : "알림 클릭 시 실행"}
                  </p>
                  <p className="mt-1 truncate text-sm" title={event.title}>
                    {event.title}
                  </p>
                  <ul className="mt-1 space-y-1">
                    {event.referenceUrls.map((target, index) => (
                      <li
                        key={`${event.id}:${index}`}
                        className="truncate text-xs text-muted-foreground"
                        title={target}
                      >
                        {target}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              열릴 링크나 파일이 없습니다.
            </p>
          )}
        </section>
        <section aria-label="최근 사용한 바로가기" className="border-t py-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-medium">바로가기 · 최근 사용</h3>
            <Button variant="ghost" size="xs" onClick={onOpenShortcuts}>
              전체 보기
            </Button>
          </div>
          {shortcutsError ? (
            <p role="alert" className="text-xs text-muted-foreground">
              {shortcutsError}
            </p>
          ) : shortcutsLoading ? (
            <p role="status" className="text-xs text-muted-foreground">
              바로가기 불러오는 중…
            </p>
          ) : shortcuts.length ? (
            <ul className="space-y-1">
              {shortcuts.map((item) => {
                const Icon =
                  item.kind === "website"
                    ? GlobeIcon
                    : item.kind === "folder"
                      ? FolderIcon
                      : MonitorIcon
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={shortcutsBusy}
                      onClick={() => onLaunch(item)}
                      title={item.target}
                      className="flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{item.name}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-xs leading-5 text-muted-foreground">
              바로가기 화면에서 실행한 항목이 여기에 표시됩니다.
            </p>
          )}
        </section>
      </div>
    </aside>
  )
}
