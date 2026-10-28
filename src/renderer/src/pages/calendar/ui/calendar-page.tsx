import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import {
  useCalendarController,
  type EventDropInfo,
  type EventResizeDoneInfo,
} from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/react/daygrid"
import timeGridPlugin from "@fullcalendar/react/timegrid"
import listPlugin from "@fullcalendar/react/list"
import interactionPlugin from "@fullcalendar/react/interaction"
import koLocale from "@fullcalendar/react/locales/ko"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  RefreshCwIcon,
  XIcon,
} from "lucide-react"
import { Button } from "@/shared/ui/button"
import type { CalendarEvent } from "../../../../../shared/calendar"
import type { CalendarStore } from "@/entities/calendar-event"
import { EventCalendarViews } from "./fullcalendar-views"
import { EventSheet } from "@/features/calendar"
import { newCalendarEvent, shiftDate } from "@/entities/calendar-event"

const plugins = [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]
const colors = {
  blue: "#2563eb",
  green: "#15803d",
  orange: "#c2410c",
  purple: "#7e22ce",
  rose: "#be123c",
}
const views = [
  { id: "dayGridMonth", label: "월" },
  { id: "timeGridWeek", label: "주" },
  { id: "timeGridDay", label: "일" },
  { id: "listWeek", label: "목록" },
]
type Editor = { event: CalendarEvent; existing: boolean; revision: string }

export default function CalendarWorkspace({
  store,
  createRequest = 0,
}: {
  store: CalendarStore
  createRequest?: number
}) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const [editor, setEditor] = useState<Editor | null>(null)
  const handledCreateRequest = useRef(0)
  const controller = useCalendarController()
  const disabled = state.busy || state.loading || !state.snapshot
  const events = useMemo(
    () =>
      state.snapshot?.events.map((event) => ({
        ...event,
        color: colors[event.color],
        contrastColor: "#ffffff",
      })) ?? [],
    [state.snapshot]
  )

  useEffect(() => {
    void store.initialize()
  }, [store])
  const edit = useCallback(
    (event: CalendarEvent, existing = false) => {
      if (!disabled && state.snapshot)
        setEditor({ event, existing, revision: state.snapshot.revision })
    },
    [disabled, state.snapshot]
  )

  useEffect(() => {
    if (
      createRequest <= handledCreateRequest.current ||
      disabled ||
      !state.snapshot
    )
      return
    handledCreateRequest.current = createRequest
    edit(newCalendarEvent())
  }, [createRequest, disabled, edit, state.snapshot])

  const move = useCallback(
    async (info: EventDropInfo | EventResizeDoneInfo) => {
      const original = state.snapshot?.events.find(
        (event) => event.id === info.event.id
      )
      if (!original || !state.snapshot || !info.event.start) {
        info.revert()
        return
      }
      const { event } = info
      const changed: CalendarEvent = {
        ...original,
        allDay: event.allDay,
        start: event.allDay
          ? event.startStr.slice(0, 10)
          : event.start!.toISOString(),
        end: event.allDay
          ? event.endStr.slice(0, 10) ||
            shiftDate(event.startStr.slice(0, 10), 1)
          : (
              event.end ?? new Date(event.start!.getTime() + 3600000)
            ).toISOString(),
      }
      if (!(await store.save(changed, state.snapshot.revision))) info.revert()
    },
    [state.snapshot, store]
  )

  return (
    <section aria-label="캘린더" className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => controller.today()}
          >
            오늘
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="이전 기간"
            onClick={() => controller.prev()}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="다음 기간"
            onClick={() => controller.next()}
          >
            <ChevronRightIcon />
          </Button>
          <h1 className="ml-2 text-base font-semibold sm:text-lg">
            {controller.view?.title ?? "캘린더"}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="캘린더 보기"
            className="flex rounded-md border p-0.5"
          >
            {views.map((view) => (
              <Button
                key={view.id}
                variant={
                  controller.view?.type === view.id ? "secondary" : "ghost"
                }
                size="sm"
                aria-pressed={controller.view?.type === view.id}
                onClick={() => controller.changeView(view.id)}
              >
                {view.label}
              </Button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="일정 새로고침"
            disabled={state.busy || state.loading}
            onClick={() => void store.refresh()}
          >
            <RefreshCwIcon />
          </Button>
          <Button
            size="sm"
            disabled={disabled}
            onClick={() => edit(newCalendarEvent())}
          >
            <PlusIcon />새 일정
          </Button>
        </div>
      </div>
      {state.error && (
        <div
          role="alert"
          className="border-b bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {state.error}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-5">
        <div className="h-full min-h-96 overflow-hidden rounded-lg border bg-background">
          <EventCalendarViews
            controller={controller}
            plugins={plugins}
            initialView="dayGridMonth"
            height="100%"
            headerToolbar={false}
            locale={koLocale}
            timeZone="local"
            firstDay={0}
            nowIndicator
            events={events}
            editable={!disabled}
            selectable={!disabled}
            selectMirror
            selectMinDistance={5}
            dayMaxEvents
            eventTimeFormat={{
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }}
            slotHeaderFormat={{
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }}
            scrollTime="08:00:00"
            allDayText="종일"
            popoverCloseContent={() => <XIcon className="size-4" />}
            dateClick={(info) => edit(newCalendarEvent(info.date, info.allDay))}
            select={(info) => {
              edit(
                newCalendarEvent(
                  info.start,
                  info.allDay,
                  info.allDay
                    ? info.endStr.slice(0, 10)
                    : info.end.toISOString()
                )
              )
            }}
            eventClick={(info) => {
              const event = state.snapshot?.events.find(
                (event) => event.id === info.event.id
              )
              if (event) edit(event, true)
            }}
            eventDrop={(info) => {
              void move(info)
            }}
            eventResize={(info) => {
              void move(info)
            }}
            noEventsContent="이 기간에 등록된 일정이 없습니다."
          />
        </div>
      </div>
      <footer className="flex items-center justify-between gap-2 border-t px-5 py-2 text-xs text-muted-foreground">
        <span role="status">
          {state.loading
            ? "일정을 불러오는 중…"
            : state.busy
              ? "저장 중…"
              : `${state.snapshot?.events.length ?? 0}개 일정`}
        </span>
        <span title={state.snapshot?.path}>
          내 컴퓨터에 저장 · {Intl.DateTimeFormat().resolvedOptions().timeZone}
        </span>
      </footer>
      {editor && (
        <EventSheet
          key={editor.event.id}
          event={editor.event}
          existing={editor.existing}
          busy={state.busy}
          serverError={state.error}
          onClose={() => setEditor(null)}
          onSave={(event) => store.save(event, editor.revision)}
          onDelete={() => store.remove(editor.event.id, editor.revision)}
        />
      )}
    </section>
  )
}
