import { Notification, shell, type BrowserWindow } from "electron"
import { isAbsolute } from "node:path"
import { stat } from "node:fs/promises"
import type { CalendarEvent } from "../shared/calendar"
import { CalendarRepository } from "./calendar-repository"
import { modeItemKey } from "../shared/item-mode"

function eventTime(event: CalendarEvent) {
  if (!event.allDay) return Date.parse(event.start)
  const [year, month, day] = event.start.split("-").map(Number)
  return new Date(year, month - 1, day, 9).getTime()
}

export class CalendarReminders {
  private readonly notifications = new Map<string, Notification>()
  private timer: ReturnType<typeof setTimeout> | undefined
  private readonly fired = new Set<string>()
  private readonly repository: CalendarRepository
  private readonly window: BrowserWindow
  private readonly visibility: () => Promise<{
    allows: (key: string) => boolean
  }>
  constructor(
    repository: CalendarRepository,
    window: BrowserWindow,
    visibility: () => Promise<{
      allows: (key: string) => boolean
    }> = async () => ({
      allows: () => true,
    })
  ) {
    this.repository = repository
    this.window = window
    this.visibility = visibility
  }

  private async openLinks(event: CalendarEvent) {
    if (!(await this.visibility()).allows(modeItemKey("event", event.id)))
      return
    for (const url of event.referenceUrls) {
      if (/^https?:\/\//i.test(url)) {
        await shell.openExternal(url).catch(() => {})
      } else if (isAbsolute(url)) {
        try {
          if ((await stat(url)).isFile()) await shell.openPath(url)
        } catch {
          // 삭제되었거나 접근할 수 없는 파일은 건너뛴다.
        }
      }
    }
  }

  private async fire(event: CalendarEvent) {
    if (!(await this.visibility()).allows(modeItemKey("event", event.id)))
      return
    const key = `${event.id}:${event.start}`
    if (this.fired.has(key)) return
    this.fired.add(key)
    if (event.notifyInApp && !this.window.isDestroyed()) {
      this.window.webContents.send("calendar:reminder", {
        id: event.id,
        title: event.title,
        openLinks: event.openLinks,
      })
    }
    if (event.notifyOS && Notification.isSupported()) {
      const notification = new Notification({
        title: event.title,
        body: "일정이 시작되었습니다.",
      })
      notification.on("click", () => {
        if (event.openLinks === "on-notification") void this.openLinks(event)
      })
      notification.show()
      this.notifications.set(event.id, notification)
    }
    if (event.openLinks === "at-start") await this.openLinks(event)
  }

  private async fireDue(scheduledTime: number) {
    const now = Date.now()
    const snapshot = await this.repository.load()
    const due = snapshot.events.filter((event) => {
      const time = eventTime(event)
      // 같은 시각의 일정만 묶는다. 과거에 놓친 오래된 일정을 한꺼번에 재생하지 않는다.
      return (
        time <= now &&
        Math.abs(time - scheduledTime) <= 60_000 &&
        !this.fired.has(`${event.id}:${event.start}`)
      )
    })
    for (const event of due) await this.fire(event)
  }

  refresh = async () => {
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
    try {
      const now = Date.now()
      const snapshot = await this.repository.load()
      const visibility = await this.visibility()
      for (const [id, notification] of this.notifications) {
        if (!visibility.allows(modeItemKey("event", id))) {
          notification.close()
          this.notifications.delete(id)
        }
      }
      const future = snapshot.events
        .filter((event) => visibility.allows(modeItemKey("event", event.id)))
        .map((event) => ({ event, time: eventTime(event) }))
        .filter(
          ({ event, time }) =>
            time > now && !this.fired.has(`${event.id}:${event.start}`)
        )
        .sort((a, b) => a.time - b.time)[0]
      if (future) {
        this.timer = setTimeout(
          () => {
            void (async () => {
              if (eventTime(future.event) <= Date.now())
                await this.fireDue(future.time)
              await this.refresh()
            })().catch(() => {})
          },
          Math.min(future.time - now, 2_147_000_000)
        )
      }
    } catch {
      // 손상되거나 일시적으로 읽을 수 없는 일정 파일은 알림 없이 보존한다.
    }
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
    for (const notification of this.notifications.values()) notification.close()
    this.notifications.clear()
  }
}
