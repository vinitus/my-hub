import { ipcMain, type BrowserWindow } from "electron"
import { CommandService } from "./command-service"
import type { CalendarRepository } from "./calendar-repository"
import type { TodoRepository } from "./todo-repository"
import type { CodexSettings } from "./codex-settings"

export function registerCommands(
  window: BrowserWindow,
  calendar: CalendarRepository,
  todos: TodoRepository,
  settings: CodexSettings,
  refreshReminders: () => void
) {
  const service = new CommandService(calendar, todos, settings, (domains) => {
    if (window.isDestroyed()) return
    if (domains.includes("calendar")) refreshReminders()
    window.webContents.send("commands:changed", domains)
  })
  ipcMain.handle("commands:execute", (event, input: unknown) => {
    if (
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame
    )
      throw new Error("허용되지 않은 요청입니다.")
    return service.execute(input)
  })
  window.on("closed", () => {
    service.dispose()
    ipcMain.removeHandler("commands:execute")
  })
}
