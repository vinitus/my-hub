import { app, ipcMain, shell, type BrowserWindow } from "electron"
import { CodexConnectionService } from "./codex-connection"
import { CodexSettings } from "./codex-settings"

export function registerCodex(window: BrowserWindow) {
  const settings = new CodexSettings(app.getPath("userData"))
  const service = new CodexConnectionService(
    (state) => {
      if (!window.isDestroyed()) window.webContents.send("codex:changed", state)
    },
    (url) => shell.openExternal(url)
  )
  const handlers = {
    "codex:check": service.check,
    "codex:connect": service.connect,
    "codex:disconnect": service.disconnect,
    "codex:cancel": service.cancel,
    "codex:preferences": () => settings.read(),
    "codex:save-preferences": (request: unknown) =>
      settings.save(service.validatePreferences(request)),
  }
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, (event, request) => {
      if (
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame
      )
        throw new Error("허용되지 않은 요청입니다.")
      return handler(request)
    })
  }
  window.on("closed", () => {
    service.dispose()
    for (const channel of Object.keys(handlers)) ipcMain.removeHandler(channel)
  })
}
