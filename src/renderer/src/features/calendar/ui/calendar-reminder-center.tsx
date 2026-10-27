import { useEffect, useRef, useState } from "react"
import { Button } from "@/shared/ui/button"
import type { CalendarReminder } from "../../../../../shared/calendar"

export function CalendarReminderCenter() {
  const [items, setItems] = useState<
    (CalendarReminder & { notificationId: number })[]
  >([])
  const nextNotificationId = useRef(0)
  const api = window.api?.calendar
  useEffect(() => {
    if (!api?.onReminder) return
    return api.onReminder((reminder) => {
      const item = { ...reminder, notificationId: nextNotificationId.current++ }
      setItems((current) => [...current.slice(-3), item])
    })
  }, [api])
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
      {items.map((item) => (
        <CalendarReminderCard
          key={item.notificationId}
          item={item}
          onOpenLinks={() => void api?.openLinks(item.id)}
          onDismiss={() =>
            setItems((current) =>
              current.filter(
                (currentItem) =>
                  currentItem.notificationId !== item.notificationId
              )
            )
          }
        />
      ))}
    </div>
  )
}

export function CalendarReminderCard({
  item,
  onOpenLinks,
  onDismiss,
}: {
  item: CalendarReminder
  onOpenLinks: () => void
  onDismiss: () => void
}) {
  return (
    <div
      role="status"
      className="pointer-events-auto rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg"
    >
      <p className="font-medium">일정 시작 · {item.title}</p>
      <div className="mt-3 flex justify-end gap-2">
        {item.openLinks === "on-notification" && (
          <Button size="sm" onClick={onOpenLinks}>
            참고 링크 열기
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          닫기
        </Button>
      </div>
    </div>
  )
}
