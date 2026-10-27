import { app, dialog, ipcMain, shell, type BrowserWindow } from "electron"
import { isAbsolute } from "node:path"
import { stat } from "node:fs/promises"
import { CalendarRepository } from "./calendar-repository"
import { CalendarReminders } from "./calendar-reminders"

export function registerCalendar(window: BrowserWindow) {
  const repository = new CalendarRepository(app.getPath("userData"))
  const reminders = new CalendarReminders(repository, window)
  void reminders.refresh()
  function check(event: Electron.IpcMainInvokeEvent) {
    if (
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame
    )
      throw new Error("허용되지 않은 요청입니다.")
  }
  ipcMain.handle("calendar:load", (event) => {
    check(event)
    return repository.load()
  })
  ipcMain.handle("calendar:save", (event, request) => {
    check(event)
    return repository.save(request).then((snapshot) => {
      void reminders.refresh()
      return snapshot
    })
  })
  ipcMain.handle("calendar:remove", (event, request) => {
    check(event)
    return repository.remove(request)
  })
  ipcMain.handle("calendar:open-links", async (event, id) => {
    check(event)
    if (typeof id !== "string") throw new Error("일정을 확인해 주세요.")
    const snapshot = await repository.load()
    const item = snapshot.events.find((candidate) => candidate.id === id)
    if (!item) throw new Error("일정을 찾을 수 없습니다.")
    for (const url of item.referenceUrls) {
      if (/^https?:\/\//i.test(url))
        await shell.openExternal(url).catch(() => {})
      else if (isAbsolute(url)) {
        try {
          if ((await stat(url)).isFile()) await shell.openPath(url)
        } catch {
          // 삭제되었거나 접근할 수 없는 파일은 건너뛴다.
        }
      }
    }
  })
  ipcMain.handle("calendar:choose-file", async (event) => {
    check(event)
    const result = await dialog.showOpenDialog(window, {
      properties: ["openFile"],
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })
  window.on("closed", () => {
    reminders.dispose()
    for (const channel of [
      "calendar:load",
      "calendar:save",
      "calendar:remove",
      "calendar:open-links",
      "calendar:choose-file",
    ])
      ipcMain.removeHandler(channel)
  })
}
