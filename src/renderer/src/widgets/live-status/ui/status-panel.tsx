import { useId } from "react"
import {
  CalendarDaysIcon,
  ListTodoIcon,
  ExternalLinkIcon,
  FolderIcon,
  GlobeIcon,
  MonitorIcon,
  FileIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
} from "lucide-react"
import { Button } from "@/shared/ui/button"
import { compareTodoPriority } from "@/features/todos"
import type { CalendarEvent } from "../../../../../shared/calendar"
import type { Shortcut } from "../../../../../shared/shortcuts"
import type { Todo } from "../../../../../shared/todos"
import { panelSchedule } from "../model/panel-status"

export type StatusPanelProps = {
  open: boolean
  width?: number
  fillContainer?: boolean
  onOpenChange: (open: boolean) => void
  events: CalendarEvent[]
  shortcuts: Shortcut[]
  todos: Todo[]
  now: number
  calendarLoading?: boolean
  calendarError?: string
  shortcutsLoading?: boolean
  shortcutsError?: string
  shortcutsBusy?: boolean
  todosLoading?: boolean
  todosError?: string
  todosBusy?: boolean
  onLaunch: (item: Shortcut) => void
  onOpenCalendar: () => void
  onOpenShortcuts: () => void
  onToggleTodo: (todo: Todo, completed: boolean) => void
  onOpenTodos: () => void
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
  width = 280,
  fillContainer = false,
  onOpenChange,
  events,
  shortcuts,
  todos,
  now,
  calendarLoading = false,
  calendarError = "",
  shortcutsLoading = false,
  shortcutsError = "",
  shortcutsBusy = false,
  todosLoading = false,
  todosError = "",
  todosBusy = false,
  onLaunch,
  onOpenCalendar,
  onOpenShortcuts,
  onToggleTodo,
  onOpenTodos,
}: StatusPanelProps) {
  const contentId = useId()
  const { today, executions } = panelSchedule(events, now)
  const calendarMessage =
    calendarError || (calendarLoading ? "일정 불러오는 중…" : "")
  const pendingTodos = todos
    .filter((todo) => !todo.completed)
    .toSorted(
      (a, b) =>
        (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31") ||
        compareTodoPriority(a, b)
    )
  const date = new Date(now)
  const todayDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
  return (
    <aside
      aria-label="실시간 현황"
      style={{ width: fillContainer ? "100%" : open ? width : 40 }}
      className="flex h-full min-h-0 w-full shrink-0 flex-col border-l bg-background"
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
        <section aria-label="오늘의 일정" className="border-t py-3">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-xs font-medium">
              <CalendarDaysIcon className="size-3.5" />
              오늘의 일정{" "}
              <span className="text-muted-foreground">{today.length}</span>
            </h3>
            <Button
              variant="ghost"
              size="xs"
              aria-label="오늘 일정 전체 보기"
              onClick={onOpenCalendar}
            >
              {today.length > 1 ? `외 ${today.length - 1}개 보기` : "전체 보기"}
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
              {today.slice(0, 1).map((event) => (
                <li key={event.id} className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    {eventTime(event, now)}
                  </p>
                  <p
                    className="mt-0.5 line-clamp-2 text-sm wrap-anywhere"
                    title={event.title}
                  >
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
        <section aria-label="할일" className="border-t py-3">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-xs font-medium">
              <ListTodoIcon className="size-3.5" />
              할일{" "}
              <span className="text-muted-foreground">
                {pendingTodos.length}
              </span>
            </h3>
            <Button
              variant="ghost"
              size="xs"
              aria-label="할일 전체 보기"
              onClick={onOpenTodos}
            >
              {pendingTodos.length > 3
                ? `외 ${pendingTodos.length - 3}개 보기`
                : "전체 보기"}
            </Button>
          </div>
          {todosError ? (
            <p role="alert" className="text-xs text-muted-foreground">
              {todosError}
            </p>
          ) : todosLoading ? (
            <p role="status" className="text-xs text-muted-foreground">
              할일 불러오는 중…
            </p>
          ) : pendingTodos.length ? (
            <>
              <ul className="space-y-1">
                {pendingTodos.slice(0, 3).map((todo) => (
                  <li
                    key={todo.id}
                    className="flex min-w-0 items-start gap-2 rounded-md px-1 py-1.5"
                  >
                    <input
                      type="checkbox"
                      aria-label={`${todo.title} 완료`}
                      checked={false}
                      disabled={todosBusy}
                      onChange={() => onToggleTodo(todo, true)}
                      className="mt-0.5 size-3.5 shrink-0 accent-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className="line-clamp-2 text-sm wrap-anywhere"
                        title={todo.title}
                      >
                        {todo.title}
                      </p>
                      {todo.dueDate && (
                        <p
                          className={`mt-0.5 text-xs ${todo.dueDate < todayDate ? "text-destructive" : "text-muted-foreground"}`}
                        >
                          {todo.dueDate < todayDate
                            ? "기한 지남"
                            : todo.dueDate === todayDate
                              ? "오늘 마감"
                              : "마감"}{" "}
                          {todo.dueDate}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              남은 할일이 없습니다.
            </p>
          )}
        </section>
        {executions.length > 0 && !calendarMessage && (
          <section aria-label="예정된 실행" className="border-t py-3">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-xs font-medium">
                <ExternalLinkIcon className="size-3.5" />
                예정된 실행{" "}
                <span className="text-muted-foreground">
                  {executions.length}
                </span>
              </h3>
              <Button
                variant="ghost"
                size="xs"
                aria-label="예정된 실행 전체 보기"
                onClick={onOpenCalendar}
              >
                {executions.length > 2
                  ? `외 ${executions.length - 2}개 보기`
                  : "전체 보기"}
              </Button>
            </div>
            {calendarMessage ? (
              <p className="text-xs text-muted-foreground">{calendarMessage}</p>
            ) : executions.length ? (
              <ul className="space-y-4">
                {executions.slice(0, 2).map((event) => (
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
                    <Button
                      variant="ghost"
                      size="xs"
                      className="px-0 text-muted-foreground"
                      title={event.referenceUrls.join("\n")}
                      onClick={onOpenCalendar}
                    >
                      {event.referenceUrls.length}개 대상 확인
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                열릴 링크나 파일이 없습니다.
              </p>
            )}
          </section>
        )}
        {(shortcuts.length > 0 || shortcutsLoading || shortcutsError) && (
          <section aria-label="최근 사용한 바로가기" className="border-t py-3">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-medium">바로가기 · 최근 사용</h3>
              <Button
                variant="ghost"
                size="xs"
                aria-label="최근 바로가기 전체 보기"
                onClick={onOpenShortcuts}
              >
                {shortcuts.length > 3
                  ? `외 ${shortcuts.length - 3}개 보기`
                  : "전체 보기"}
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
                {shortcuts.slice(0, 3).map((item) => {
                  const Icon =
                    item.kind === "website"
                      ? GlobeIcon
                      : item.kind === "folder"
                        ? FolderIcon
                        : item.kind === "file"
                          ? FileIcon
                          : MonitorIcon
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        disabled={shortcutsBusy}
                        onClick={() => onLaunch(item)}
                        title={`${item.name}\n${item.target}`}
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
        )}
      </div>
    </aside>
  )
}
