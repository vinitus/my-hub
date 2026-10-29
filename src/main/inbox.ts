import { app, dialog, ipcMain, shell, type BrowserWindow } from "electron"
import { isAbsolute } from "node:path"
import { stat } from "node:fs/promises"
import { z } from "zod"
import { websiteUrl } from "../shared/shortcuts"
import { InboxRepository } from "./inbox-repository"

export function registerInbox(
  window: BrowserWindow,
  repository = new InboxRepository(app.getPath("userData"))
) {
  const channels: string[] = []
  function handle(channel: string, action: (request: unknown) => unknown) {
    channels.push(channel)
    ipcMain.handle(channel, (event, request) => {
      if (
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame
      )
        throw new Error("허용되지 않은 요청입니다.")
      return action(request)
    })
  }
  handle("inbox:load", repository.load)
  handle("inbox:capture", (request) =>
    repository.capture(request as Parameters<typeof repository.capture>[0])
  )
  handle("inbox:process", (request) =>
    repository.process(request as Parameters<typeof repository.process>[0])
  )
  handle("inbox:remove", (request) =>
    repository.remove(request as Parameters<typeof repository.remove>[0])
  )
  handle("inbox:choose-files", async (request) => {
    const expectedRevision = z.string().min(1).max(100).parse(request)
    const result = await dialog.showOpenDialog(window, {
      title: "인박스에 수집할 파일 선택",
      properties: ["openFile", "multiSelections"],
    })
    if (result.canceled || !result.filePaths.length) return null
    return repository.capture({
      expectedRevision,
      drafts: result.filePaths.map((content) => ({
        kind: "file",
        content,
        source: "파일 선택",
      })),
    })
  })
  handle("inbox:open", async (request) => {
    const item = await repository.resolve(request)
    if (item.kind === "link") await shell.openExternal(websiteUrl(item.content))
    else if (item.kind === "file") {
      if (!isAbsolute(item.content))
        throw new Error("올바른 파일 경로가 아닙니다.")
      await stat(item.content)
      const error = await shell.openPath(item.content)
      if (error) throw new Error(`파일을 열지 못했습니다: ${error}`)
    } else throw new Error("텍스트 항목은 원본을 열 수 없습니다.")
  })
  window.on("closed", () => {
    for (const channel of channels) ipcMain.removeHandler(channel)
  })
}
