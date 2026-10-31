import { useContentVisibility } from "@/shared/lib/content-visibility"
import { modeItemKey } from "../../../../../shared/item-mode"
import { useSyncExternalStore } from "react"
import { useLiveStatusClock } from "../model/use-live-status-clock"
import type { CalendarStore } from "@/entities/calendar-event"
import { ScheduleStatusCard } from "./schedule-status-card"
import { sidebarScheduleStatus } from "@/entities/calendar-event"

// Share the calendar's store so saved edits are reflected without polling IPC.
export function LiveScheduleStatus({ store }: { store: CalendarStore }) {
  const { allows } = useContentVisibility()
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const now = useLiveStatusClock({ calendarStore: store })

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
      status={sidebarScheduleStatus(
        state.snapshot.events.filter((item) =>
          allows(modeItemKey("event", item.id))
        ),
        now
      )}
      now={now}
    />
  )
}
