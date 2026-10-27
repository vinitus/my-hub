import { app, ipcMain, type BrowserWindow } from "electron"
import { CalendarRepository } from "./calendar-repository"

export function registerCalendar(window: BrowserWindow) {
  const repository = new CalendarRepository(app.getPath("userData"))
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
    return repository.save(request)
  })
  ipcMain.handle("calendar:remove", (event, request) => {
    check(event)
    return repository.remove(request)
  })
  window.on("closed", () => {
    for (const channel of ["calendar:load", "calendar:save", "calendar:remove"])
      ipcMain.removeHandler(channel)
  })
}
