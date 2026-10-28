import { useEffect, useState, useSyncExternalStore } from "react"
import type { CalendarStore } from "@/entities/calendar-event"
import type { ShortcutStore } from "@/features/shortcuts"
import type { TodoStore } from "@/features/todos"
import { StatusPanel } from "./status-panel"

export function LiveStatusPanel({
  calendarStore,
  shortcutStore,
  todoStore,
  open,
  onOpenChange,
  onOpenCalendar,
  onOpenShortcuts,
  onOpenTodos,
}: {
  calendarStore: CalendarStore
  shortcutStore: ShortcutStore
  todoStore: TodoStore
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenCalendar: () => void
  onOpenShortcuts: () => void
  onOpenTodos: () => void
}) {
  const calendar = useSyncExternalStore(
    calendarStore.subscribe,
    calendarStore.getSnapshot
  )
  const shortcuts = useSyncExternalStore(
    shortcutStore.subscribe,
    shortcutStore.getSnapshot
  )
  const todos = useSyncExternalStore(todoStore.subscribe, todoStore.getSnapshot)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    void calendarStore.initialize()
    void shortcutStore.initialize()
    void todoStore.initialize()
    const refresh = () => {
      setNow(Date.now())
      void calendarStore.refresh()
      void shortcutStore.refresh()
      void todoStore.refresh()
    }
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    window.addEventListener("focus", refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", refresh)
    }
  }, [calendarStore, shortcutStore, todoStore])

  const items = shortcuts.snapshot?.items ?? []
  const recent = shortcuts.recentIds.flatMap((id) => {
    const item = items.find((item) => item.id === id)
    return item ? [item] : []
  })
  return (
    <StatusPanel
      open={open}
      fillContainer
      onOpenChange={onOpenChange}
      events={calendar.snapshot?.events ?? []}
      shortcuts={recent}
      todos={todos.snapshot?.items ?? []}
      now={now}
      calendarLoading={!calendar.snapshot && !calendar.error}
      calendarError={calendar.error}
      shortcutsLoading={!shortcuts.snapshot && !shortcuts.error}
      shortcutsError={shortcuts.error}
      shortcutsBusy={shortcuts.busy || shortcuts.loading}
      todosLoading={!todos.snapshot && !todos.error}
      todosError={todos.error}
      todosBusy={todos.busy || todos.loading}
      onLaunch={(item) => void shortcutStore.launch(item)}
      onOpenCalendar={() => {
        onOpenCalendar()
        if (!window.matchMedia("(min-width: 1024px)").matches)
          onOpenChange(false)
      }}
      onOpenShortcuts={() => {
        onOpenShortcuts()
        if (!window.matchMedia("(min-width: 1024px)").matches)
          onOpenChange(false)
      }}
      onToggleTodo={(todo, completed) =>
        void todoStore.save(
          { ...todo, completed },
          todos.snapshot?.revision ?? ""
        )
      }
      onOpenTodos={() => {
        onOpenTodos()
        if (!window.matchMedia("(min-width: 1024px)").matches)
          onOpenChange(false)
      }}
    />
  )
}
