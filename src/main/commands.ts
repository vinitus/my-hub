import { ipcMain, type BrowserWindow } from "electron"
import { CommandService } from "./command-service"
import type { CalendarRepository } from "./calendar-repository"
import type { TodoRepository } from "./todo-repository"
import type { CodexSettings } from "./codex-settings"
import type { AppSettingsRepository } from "./app-settings"

export function registerCommands(
  window: BrowserWindow,
  calendar: CalendarRepository,
  todos: TodoRepository,
  settings: CodexSettings,
  refreshReminders: () => void,
  mode?: AppSettingsRepository
) {
  const service = new CommandService(
    calendar,
    todos,
    settings,
    (domains) => {
      if (window.isDestroyed()) return
      if (domains.includes("calendar")) refreshReminders()
      window.webContents.send("commands:changed", domains)
    },
    undefined,
    undefined,
    mode?.visibility
  )
  const methods = {
    execute: service.execute,
    apply: service.apply,
    discard: service.discard,
    undo: service.undo,
  }
  for (const [method, handle] of Object.entries(methods)) {
    ipcMain.handle(`commands:${method}`, (event, input: unknown) => {
      if (
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame
      )
        throw new Error("허용되지 않은 요청입니다.")
      return handle(input)
    })
  }
  window.on("closed", () => {
    service.dispose()
    for (const method of Object.keys(methods))
      ipcMain.removeHandler(`commands:${method}`)
  })
}
