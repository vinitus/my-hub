import { useEffect, useState } from "react"
import type { CalendarStore } from "@/entities/calendar-event"

type RefreshableStore = Pick<CalendarStore, "initialize" | "refresh">

// Each mounted widget keeps its own clock and focus subscription. Store
// initialization remains idempotent in the stores, including under StrictMode.
export function useLiveStatusClock({
  calendarStore,
  shortcutStore,
  todoStore,
}: {
  calendarStore: RefreshableStore
  shortcutStore?: RefreshableStore
  todoStore?: RefreshableStore
}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    void calendarStore.initialize()
    void shortcutStore?.initialize()
    void todoStore?.initialize()
    const refresh = () => {
      setNow(Date.now())
      void calendarStore.refresh()
      void shortcutStore?.refresh()
      void todoStore?.refresh()
    }
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    window.addEventListener("focus", refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", refresh)
    }
  }, [calendarStore, shortcutStore, todoStore])

  return now
}
