import { useState, useSyncExternalStore } from "react"
import { newCalendarEvent, type CalendarStore } from "@/entities/calendar-event"
import type { TodoStore } from "@/features/todos"
import type { ShortcutStore } from "@/features/shortcuts"
import { hasOpenDialog } from "@/shared/lib/has-open-dialog"
import type { CalendarEvent } from "../../../../shared/calendar"
import type { Shortcut } from "../../../../shared/shortcuts"
import type { Todo } from "../../../../shared/todos"

export type HomeCreateSession =
  | { kind: "todo"; revision: string | null }
  | { kind: "event"; revision: string | null; event: CalendarEvent }
  | { kind: "shortcut"; revision: string | null; item: Shortcut }

export function useHomeCreate({
  todoStore,
  calendarStore,
  shortcutStore,
  createEvent = newCalendarEvent,
}: {
  todoStore: TodoStore
  calendarStore: CalendarStore
  shortcutStore: ShortcutStore
  createEvent?: () => CalendarEvent
}) {
  const [session, setSession] = useState<HomeCreateSession | null>(null)
  const todos = useSyncExternalStore(todoStore.subscribe, todoStore.getSnapshot)
  const calendar = useSyncExternalStore(
    calendarStore.subscribe,
    calendarStore.getSnapshot
  )
  const shortcuts = useSyncExternalStore(
    shortcutStore.subscribe,
    shortcutStore.getSnapshot
  )
  const storeFor = (kind: HomeCreateSession["kind"]) =>
    kind === "todo"
      ? todoStore
      : kind === "event"
        ? calendarStore
        : shortcutStore
  const state =
    session?.kind === "todo"
      ? todos
      : session?.kind === "event"
        ? calendar
        : shortcuts

  // 모달을 연 시점의 revision을 고정해 편집 중 외부 변경을 덮어쓰지 않는다.
  async function prepare(request: HomeCreateSession, refresh = false) {
    const store = storeFor(request.kind)
    await (refresh ? store.refresh() : store.initialize())
    const snapshot = store.getSnapshot().snapshot
    if (snapshot)
      setSession((current) =>
        current === request
          ? { ...request, revision: snapshot.revision }
          : current
      )
  }
  function open(kind: HomeCreateSession["kind"]) {
    if (hasOpenDialog()) return
    const request: HomeCreateSession =
      kind === "todo"
        ? { kind, revision: null }
        : kind === "event"
          ? { kind, revision: null, event: createEvent() }
          : {
              kind,
              revision: null,
              item: {
                id: crypto.randomUUID(),
                name: "",
                kind: "program",
                target: "",
              },
            }
    if (kind === "todo") todoStore.clearFeedback()
    if (kind === "shortcut") shortcutStore.clearFeedback()
    setSession(request)
    void prepare(request)
  }
  return {
    session,
    busy: state.busy || state.loading,
    error: state.error,
    onClose: () => setSession(null),
    onRetry: () => {
      if (session) void prepare(session, true)
    },
    onSaveTodo: (todo: Todo) =>
      session?.kind === "todo" && session.revision !== null
        ? todoStore.save(todo, session.revision)
        : Promise.resolve(false),
    onSaveEvent: (event: CalendarEvent) =>
      session?.kind === "event" && session.revision !== null
        ? calendarStore.save(event, session.revision)
        : Promise.resolve(false),
    onSaveShortcut: (item: Shortcut) =>
      session?.kind === "shortcut" && session.revision !== null
        ? shortcutStore.save(item, session.revision)
        : Promise.resolve(false),
    onChoose: shortcutStore.choose,
    open,
  }
}
