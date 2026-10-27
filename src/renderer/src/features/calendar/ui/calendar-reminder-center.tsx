import { useEffect, useState } from "react"
import { Button } from "@/shared/ui/button"
import type { CalendarReminder } from "../../../../../shared/calendar"

export function CalendarReminderCenter() {
  const [items, setItems] = useState<CalendarReminder[]>([])
  const api = window.api?.calendar
  useEffect(() => {
    if (!api?.onReminder) return
    return api.onReminder((reminder) => {
      setItems((current) => [...current.slice(-3), reminder])
    })
  }, [api])
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
      {items.map((item, index) => (
        <div
          key={`${item.id}-${index}`}
          role="status"
          className="pointer-events-auto rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg"
        >
          <p className="font-medium">일정 시작 · {item.title}</p>
          <div className="mt-3 flex justify-end gap-2">
            {item.openLinks === "on-notification" && (
              <Button size="sm" onClick={() => void api?.openLinks(item.id)}>
                참고 링크 열기
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setItems((current) =>
                  current.filter((_, currentIndex) => currentIndex !== index)
                )
              }
            >
              닫기
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
