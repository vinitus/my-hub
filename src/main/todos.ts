import { app, ipcMain, type BrowserWindow } from "electron"
import { TodoRepository } from "./todo-repository"

export function registerTodos(window: BrowserWindow) {
  const repository = new TodoRepository(app.getPath("userData"))
  const channels = ["todos:load", "todos:save", "todos:remove"] as const
  for (const channel of channels) {
    ipcMain.handle(channel, (event, request: unknown) => {
      if (
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame
      )
        throw new Error("허용되지 않은 요청입니다.")
      if (channel === "todos:save")
        return repository.save(request as Parameters<typeof repository.save>[0])
      if (channel === "todos:remove")
        return repository.remove(
          request as Parameters<typeof repository.remove>[0]
        )
      return repository.load()
    })
  }
  window.on("closed", () => {
    for (const channel of channels) ipcMain.removeHandler(channel)
  })
}
