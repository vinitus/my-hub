import { useEffect, useState, useSyncExternalStore } from "react"
import type { CalendarStore } from "@/entities/calendar-event"
import type { ShortcutStore } from "@/features/shortcuts"
import { StatusPanel } from "./status-panel"

export function LiveStatusPanel({
  calendarStore,
  shortcutStore,
  onOpenCalendar,
  onOpenShortcuts,
}: {
  calendarStore: CalendarStore
  shortcutStore: ShortcutStore
  onOpenCalendar: () => void
  onOpenShortcuts: () => void
}) {
  const calendar = useSyncExternalStore(
    calendarStore.subscribe,
    calendarStore.getSnapshot
  )
  const shortcuts = useSyncExternalStore(
    shortcutStore.subscribe,
    shortcutStore.getSnapshot
  )
  const [now, setNow] = useState(() => Date.now())
  const [open, setOpen] = useState(true)

  useEffect(() => {
    void calendarStore.initialize()
    void shortcutStore.initialize()
    const refresh = () => {
      setNow(Date.now())
      void calendarStore.refresh()
      void shortcutStore.refresh()
    }
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    window.addEventListener("focus", refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", refresh)
    }
  }, [calendarStore, shortcutStore])

  const items = shortcuts.snapshot?.items ?? []
  const recent = shortcuts.recentIds.flatMap((id) => {
    const item = items.find((item) => item.id === id)
    return item ? [item] : []
  })
  return (
    <StatusPanel
      open={open}
      onOpenChange={setOpen}
      events={calendar.snapshot?.events ?? []}
      shortcuts={recent}
      now={now}
      calendarLoading={!calendar.snapshot && !calendar.error}
      calendarError={calendar.error}
      shortcutsLoading={!shortcuts.snapshot && !shortcuts.error}
      shortcutsError={shortcuts.error}
      shortcutsBusy={shortcuts.busy || shortcuts.loading}
      onLaunch={(item) => void shortcutStore.launch(item)}
      onOpenCalendar={() => {
        onOpenCalendar()
        if (!window.matchMedia("(min-width: 1024px)").matches) setOpen(false)
      }}
      onOpenShortcuts={() => {
        onOpenShortcuts()
        if (!window.matchMedia("(min-width: 1024px)").matches) setOpen(false)
      }}
    />
  )
}
