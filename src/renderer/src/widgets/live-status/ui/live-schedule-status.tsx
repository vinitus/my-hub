import { useEffect, useState, useSyncExternalStore } from "react"
import type { CalendarStore } from "@/entities/calendar-event"
import { ScheduleStatusCard } from "./schedule-status-card"
import { sidebarScheduleStatus } from "@/entities/calendar-event"

// Share the calendar's store so saved edits are reflected without polling IPC.
export function LiveScheduleStatus({ store }: { store: CalendarStore }) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    void store.initialize()
    const refresh = () => {
      setNow(Date.now())
      void store.refresh()
    }
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    window.addEventListener("focus", refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", refresh)
    }
  }, [store])

  if (!state.snapshot) {
    return (
      <div
        className="flex h-[70px] shrink-0 items-center rounded-lg bg-card px-4 text-xs text-muted-foreground"
        aria-busy={!state.error}
        title={state.error || undefined}
      >
        {state.error ? "일정을 불러오지 못했습니다." : "일정 불러오는 중…"}
      </div>
    )
  }

  return (
    <ScheduleStatusCard
      status={sidebarScheduleStatus(state.snapshot.events, now)}
      now={now}
    />
  )
}
